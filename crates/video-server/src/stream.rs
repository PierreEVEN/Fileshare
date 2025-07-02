use crate::media_info::MediaInfo;
use crate::stream_id::StreamId;
use crate::tracks::audio_transcode::AudioTranscodeTrack;
use crate::tracks::{Track, TrackConfig};
use std::path::PathBuf;
use std::sync::Arc;
use std::{fs};
use std::collections::HashMap;
use std::os::unix::fs::MetadataExt;
use std::time::Duration;
use lazy_static::lazy_static;
use tokio::sync::RwLock;
use tokio::time::sleep;
use types::database_ids::ItemId;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;
use crate::error::{ErrorKind, StreamingError};
use crate::stream_track_builder::StreamTrackBuilder;
use crate::tracks::track_preset::TrackPreset;
use crate::tracks::video_transcode::VideoTranscodeTrack;

pub struct StreamConfig {
    config: VideoServerConfig,
    item_id: ItemId,
    stream_id: StreamId,
    source: PathBuf,
    input_info: MediaInfo,
}

impl StreamConfig {
    pub fn new(config: VideoServerConfig, item_id: ItemId, source: PathBuf) -> Result<Self, StreamingError> {
        let source = if source.is_absolute() { source } else { std::path::absolute(source)? };
        let info = MediaInfo::new(&source)?;
        Ok(Self {
            config,
            item_id,
            stream_id: Default::default(),
            source,
            input_info: info,
        })
    }

    pub fn item_id(&self) -> &ItemId { &self.item_id }
    pub fn stream_id(&self) -> &StreamId { &self.stream_id }
    pub fn config(&self) -> &VideoServerConfig { &self.config }
    pub fn source(&self) -> &PathBuf { &self.source }
    pub fn info(&self) -> &MediaInfo { &self.input_info }

    pub fn chunk_path_num(&self, chunk_num: u32, track_id: u32) -> Result<PathBuf, StreamingError> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join(format!("{chunk_num}.m4s"));
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }
    pub fn chunk_path(&self, track_id: u32) -> Result<PathBuf, StreamingError> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join("%d.m4s".to_string());
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }

    pub fn init_seg(&self, start_num: u32, track_id: u32) -> Result<PathBuf, StreamingError> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join(format!("{}_init.mp4", &start_num));
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }
    pub fn playlist_path(&self, track_id: u32) -> Result<PathBuf, StreamingError> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join("playlist.m3u8");
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }
}


lazy_static! {
    static ref STREAM_TRACKS: RwLock<HashMap<PathBuf, HashMap<u32, StreamTrackBuilder>>> = RwLock::default();
}


pub struct Stream {
    state: Arc<StreamConfig>,
    tracks: HashMap<u32, Box<dyn Track>>//Vec<(Box<dyn Track>, RwLock<Option<StreamerProcess>>)>,
}
unsafe impl Send for Stream {}
unsafe impl Sync for Stream {}

impl Stream {
    pub fn new(mut state: StreamConfig, id: StreamId) -> Result<Self, StreamingError> {
        state.stream_id = id;
        let state = Arc::new(state);

        let mut tracks: HashMap<u32, Box<dyn Track>> = HashMap::new();


        for track in state.input_info.get_video_tracks() {

            for preset in TrackPreset::create_presets(state.input_info.get_track(track)?)? {
                let track_id = tracks.len() as u32;
                fs::create_dir_all(&state.config().cache_path.join(id.to_string()).join(track_id.to_string()))?;
                tracks.insert(track_id, Box::new(VideoTranscodeTrack::new(
                    TrackConfig::new(state.clone(), track, track_id)
                )));
            }
        }

        for track in state.input_info.get_audio_tracks() {
            let track_id = tracks.len() as u32;
            fs::create_dir_all(&state.config().cache_path.join(id.to_string()).join(track_id.to_string()))?;
            tracks.insert(track_id, Box::new(AudioTranscodeTrack::new(
                TrackConfig::new(state.clone(), track, track_id)
            )));
        }

        Ok(Self {
            state,
            tracks,
        })
    }

    pub fn get_dash_manifest(&self, start_num: u32) -> Result<String, StreamingError> {
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

        let duration = timestamp_to_xml(self.state.input_info.get_duration().ok_or(StreamingError::new(ErrorKind::MissingData("Duration")))? as u64);

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
            w.write_text(format!("/api/stream/{}/", self.state.stream_id).as_str());
        }
        w.end_element();

        w.start_element("Period");
        {
            w.write_attribute("duration", &duration);
            for (track, _) in &self.tracks {
                track.build_manifest(&mut w, start_num, self.state.input_info.get_bitrate())?;
            }
        }
        w.end_element();

        Ok(w.end_document())
    }

    pub async fn get_init_chunk(&self, track_id: u32, start_num: u32) -> Result<PathBuf, StreamingError> {
        let path = self.state.init_seg(start_num, track_id)?;

        if !path.exists() {
            self.start_from(start_num).await?;
        }

        let mut attempt = 50;
        loop {
            if path.exists() && path.metadata()?.size() > 0 {
                break;
            }
            sleep(Duration::from_millis(100)).await;
            attempt -= 1;
            if attempt == 0 { break }
        }

        if !path.exists() {
            return Err(StreamingError::new(ErrorKind::InitNotFound{track: track_id, num: start_num}));
        }

        Ok(path)
    }

    pub async fn get_chunk(&self, track_id: u32, chunk_id: u32) -> Result<PathBuf, StreamingError> {
        unsafe {
            if let Some(media) = STREAM_TRACKS.get(&self.state.chunk_path_num(chunk_id, track_id)?) {
                let track = media.get(&track_id).ok_or(StreamingError::new(ErrorKind::NoTrack(track_id)))?;
                track.get_chunk(&self.state.stream_id, chunk_id).await
            } else {
                todo!("Create media")
            }
        }
    }

    pub async fn kill(&self) -> Result<(), StreamingError> {
        for (_, streaming_process) in &self.tracks {
            todo!()
        }
        Ok(())
    }

    pub async fn start_from(&self, start_num: u32) -> Result<(), StreamingError> {
        for (track, streaming_process) in &self.tracks {
            todo!()
        }
        Ok(())
    }

    pub fn item_id(&self) -> &ItemId {
        &self.state.item_id
    }
}
