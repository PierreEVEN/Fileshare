use std::fs;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;
use tracing::{error, info};
use xmlwriter::XmlWriter;
use utils::config::VideoServerConfig;
use crate::error::{ErrorKind, StreamingError};
use crate::media_info::media_info::{CodecType, MediaInfo};
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::stream_track::{StreamTrack, TrackDefinition};
use crate::media_stream::StreamingStats;
use crate::media_stream::track_preset::TranscodingMode;

pub struct MediaStream {
    stream_reference: StreamReference,
    last_usage: RwLock<SystemTime>,
    global_config: Arc<VideoServerConfig>,
    tracks: Vec<StreamTrack>,
    media_info: MediaInfo,
}

impl MediaStream {
    pub fn new(global_config: Arc<VideoServerConfig>, stats: Arc<StreamingStats>, stream_reference: StreamReference) -> Result<Self, StreamingError> {
        let media_info = MediaInfo::new(stream_reference.path())?;
        let mut tracks = vec![];

        for track in 0..media_info.get_tracks().len() {
            let definition = TrackDefinition::new(&media_info, track as u32)?;
            match definition.codec_type {
                CodecType::Audio | CodecType::Video => {
                    tracks.push(StreamTrack::new(
                        global_config.clone(),
                        stats.clone(),
                        stream_reference.clone(),
                        definition,
                        tracks.len() as u32))
                }
                _ => {}
            }
        }

        Ok(Self {
            media_info,
            stream_reference,
            last_usage: RwLock::new(SystemTime::now()),
            global_config,
            tracks,
        })
    }

    pub async fn get_stats(&self) -> Result<String, StreamingError> {
        let mut stats = String::new();
        for track in &self.tracks {
            for preset in track.get_presets().await {
                let transcode = match preset.should_transcode()? {
                    TranscodingMode::Raw => { "" }
                    _ => { ":transcode" }
                };
                let codec = if let Some(codec) = &preset.parent_track().codec { format!("{codec}") } else { String::new() };
                stats += format!("{}({codec}{transcode} : {})", preset.parent_track().codec_type, preset.description().to_string()).as_str()
            }
        }
        Ok(stats)
    }

    pub fn identifier(&self) -> &String {
        self.stream_reference.id()
    }

    // Return true when we can consider this media stream is not used anymore and we can destroy it
    pub async fn is_orphan(&self) -> Result<bool, StreamingError> {
        Ok(SystemTime::now().duration_since(*self.last_usage.read().await)? > self.global_config.stream_ttl)
    }

    // Mark this stream as alive by resetting the destroy counter
    async fn touch(&self) {
        *self.last_usage.write().await = SystemTime::now();
    }

    pub async fn destroy(&self) -> Result<(), StreamingError> {
        info!("Destroy stream {}", self.stream_reference.id());
        #[allow(unused)]
        let cache = self.global_config.cache_path.join(self.stream_reference.path().file_name().unwrap());
        if let Err(err) = fs::remove_dir_all(&cache) {
            error!("Failed to remove stream cache for {} : {}", cache.display(), err);
        }
        Ok(())
    }

    pub async fn tick(&self) -> Result<(), StreamingError> {
        for track in &self.tracks {
            track.tick().await?
        }
        Ok(())
    }


    pub async fn compile_dash_manifest(&self, start_num: u32) -> Result<String, StreamingError> {
        fn timestamp_to_xml(t: u64) -> String {
            let h = t / 3600;
            let m = t % 3600 / 60;
            let s = t % 3600 % 60;
            let mut tag = "PT".to_string();
            if h != 0 { tag = format!("{}{}H", tag, h); }
            if m != 0 { tag = format!("{}{}M", tag, m); }
            if s != 0 { tag = format!("{}{}S", tag, s); }
            tag
        }
        let duration = timestamp_to_xml(self.media_info.get_duration().ok_or(StreamingError::new(ErrorKind::MissingData("Duration")))? as u64);

        let mut w = XmlWriter::new(Default::default());
        w.write_declaration();

        w.start_element("MPD");
        w.write_attribute("xmlns", "urn:mpeg:dash:schema:mpd:2011");
        w.write_attribute("xmlns:xsi", "https://www.w3.org/2001/XMLSchema-instance");
        w.write_attribute("xsi:schemaLocation", "urn:mpeg:dash:schema:mpd:2011 https://standards.iso.org/ittf/PubliclyAvailableStandards/MPEG-DASH_schema_files/DASH-MPD.xsd");
        w.write_attribute("profiles", "urn:mpeg:dash:profile:full:2011");
        w.write_attribute("type", "static");
        w.write_attribute("mediaPresentationDuration", &duration);
        w.write_attribute("minBufferTime", "PT20S");
        w.write_attribute("maxSegmentDuration", "PT20S");

        w.start_element("BaseURL");
        {
            w.write_text(&format!("/api/stream/{}/", self.stream_reference.id()));
        }
        w.end_element();

        w.start_element("Period");
        {
            w.write_attribute("duration", &duration);
            for track in &self.tracks {
                track.compile_manifest(&mut w, start_num).await?;
            }
        }
        w.end_element();

        Ok(w.end_document().replace("&", "&amp;"))
    }

    pub async fn get_track(&self, output_track: u32) -> Result<&StreamTrack, StreamingError> {
        self.touch().await;
        self.tracks.get(output_track as usize).ok_or(StreamingError::new(ErrorKind::NoTrack(output_track)))
    }
}