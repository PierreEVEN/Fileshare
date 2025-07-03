use crate::error::{ErrorKind, StreamingError};
use crate::media_info::MediaInfo;
use crate::stream_id::StreamId;
use crate::{PresetPool};
use std::path::PathBuf;
use std::sync::Arc;
use types::database_ids::ItemId;
use xmlwriter::XmlWriter;
use crate::tracks::presets::preset_ref::PresetRef;
use crate::tracks::track::Track;

// Stream shared data
pub struct StreamState {
    item_id: ItemId,
    stream_id: StreamId,
    // Source file path
    source: PathBuf,
    // Media data fetched from ffprobe
    media_info: MediaInfo,
}

pub struct Stream {
    stream_state: Arc<StreamState>,
    tracks: Vec<Box<Track>>,
    preset_pool: PresetPool,
}

impl StreamState {
    pub fn new(item_id: ItemId, source: PathBuf) -> Result<Self, StreamingError> {
        Ok(Self {
            item_id,
            stream_id: Default::default(),
            media_info: MediaInfo::new(&source)?,
            source: std::path::absolute(source)?,
        })
    }
    pub fn item_id(&self) -> &ItemId { &self.item_id }
    pub fn stream_id(&self) -> &StreamId { &self.stream_id }
    pub fn source(&self) -> &PathBuf { &self.source }
    pub fn media_info(&self) -> &MediaInfo { &self.media_info }
}

impl Stream {
    pub fn new(mut state: StreamState, id: StreamId, preset_pool: PresetPool) -> Result<Self, StreamingError> {
        state.stream_id = id;
        let stream_state = Arc::new(state);

        let mut tracks: Vec<Box<Track>> = vec![];

        for input_track in stream_state.media_info.get_video_tracks() {
            let output_track = tracks.len() as u32;
            tracks.push(Box::new(Track::new(stream_state.clone(), input_track, output_track)));
        }

        for input_track in stream_state.media_info.get_audio_tracks() {
            let output_track = tracks.len() as u32;
            tracks.push(Box::new(Track::new(stream_state.clone(), input_track, output_track)));
        }

        Ok(Self {
            stream_state,
            tracks,
            preset_pool,
        })
    }

    pub fn compile_dash_manifest(&self, start_num: u32) -> Result<String, StreamingError> {
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

        let duration = timestamp_to_xml(self.stream_state.media_info.get_duration().ok_or(StreamingError::new(ErrorKind::MissingData("Duration")))? as u64);

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
            w.write_text(format!("/api/stream/{}/", self.stream_state.stream_id).as_str());
        }
        w.end_element();

        w.start_element("Period");
        {
            w.write_attribute("duration", &duration);
            for track in &self.tracks {
                track.compile_manifest(&mut w, start_num)?;
            }
        }
        w.end_element();

        Ok(w.end_document())
    }

    pub async fn get_init_chunk(&self, track_index: u32, configuration: String, start_num: u32) -> Result<PathBuf, StreamingError> {
        let preset_ref = PresetRef::new(track_index, configuration, self.stream_state.source.clone());
        let preset = self.preset_pool.find_or_create_preset(&preset_ref).await?;
        preset.get_init_chunk(self.stream_state.stream_id(), start_num).await
    }

    pub async fn get_chunk(&self, track_index: u32, configuration: String, chunk: u32) -> Result<PathBuf, StreamingError> {
        let preset_ref = PresetRef::new(track_index, configuration, self.stream_state.source.clone());
        let preset = self.preset_pool.find_or_create_preset(&preset_ref).await?;
        preset.get_chunk(self.stream_state.stream_id(), chunk).await
    }

    pub async fn kill(&self) -> Result<(), StreamingError> {
        for track in &self.tracks {
            for preset in track.get_presets() {
                let preset_ref = PresetRef::new(track.state().output_track, preset.to_string(), self.stream_state.source.clone());
                if let Some(builder) = self.preset_pool.get_builder(&preset_ref).await {
                    builder.disconnect_stream(self.stream_state.stream_id()).await?;
                }
            }
        }
        Ok(())
    }

    pub fn item_id(&self) -> &ItemId {
        &self.stream_state.item_id
    }
}

unsafe impl Send for Stream {}
unsafe impl Sync for Stream {}