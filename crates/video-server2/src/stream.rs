use crate::error::{ErrorKind, StreamingError};
use crate::media_info::MediaInfo;
use crate::stream_id::StreamId;
use crate::tracks::presets::preset_ref::PresetRef;
use crate::tracks::track::Track;
use crate::MediaStreamPool;
use std::path::PathBuf;
use std::sync::Arc;
use types::database_ids::ItemId;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;

// Stream shared data
pub struct StreamState {
    item_id: ItemId,
    stream_id: StreamId,
    // Source file path
    source: PathBuf,
    // Media data fetched from ffprobe
    media_info: MediaInfo,
    global_config: Option<Arc<VideoServerConfig>>,
}

pub struct Stream {
    stream_state: Arc<StreamState>,
    tracks: Vec<Track>,
    preset_pool: MediaStreamPool,
}

impl StreamState {
    pub fn new(item_id: ItemId, source: PathBuf) -> Result<Self, StreamingError> {
        Ok(Self {
            item_id,
            stream_id: Default::default(),
            media_info: MediaInfo::new(&source)?,
            source: std::path::absolute(source)?,
            global_config: None,
        })
    }
    pub fn item_id(&self) -> &ItemId { &self.item_id }
    pub fn stream_id(&self) -> &StreamId { &self.stream_id }
    pub fn source(&self) -> &PathBuf { &self.source }
    pub fn media_info(&self) -> &MediaInfo { &self.media_info }
    pub fn global_config(&self) -> Result<&Arc<VideoServerConfig>, StreamingError> { self.global_config.as_ref().ok_or(StreamingError::new(ErrorKind::Other("Config is not initialized".to_string()))) }
}

impl Stream {
    pub fn new(global_config: Arc<VideoServerConfig>, mut state: StreamState, id: StreamId, preset_pool: MediaStreamPool) -> Result<Self, StreamingError> {
        state.stream_id = id;
        state.global_config = Some(global_config);
        let stream_state = Arc::new(state);

        let mut tracks: Vec<Track> = vec![];

        for input_track in stream_state.media_info.get_video_tracks() {
            let output_track = tracks.len() as u32;
            tracks.push(Track::new(stream_state.clone(), input_track, output_track)?);
        }

        for input_track in stream_state.media_info.get_audio_tracks() {
            let output_track = tracks.len() as u32;
            tracks.push(Track::new(stream_state.clone(), input_track, output_track)?);
        }

        Ok(Self {
            stream_state,
            tracks,
            preset_pool,
        })
    }


    pub async fn get_init_chunk(&self, track_index: u32, configuration: String, start_num: u32) -> Result<PathBuf, StreamingError> {
        let preset_ref = PresetRef::new(track_index, configuration, self.stream_state.source.clone());
        let preset = self.preset_pool.find_or_create_preset(&preset_ref).await?;
        let track = self.tracks.get(track_index as usize).ok_or(StreamingError::new(ErrorKind::NoTrack(track_index)))?;
        preset.get_init_chunk(track, start_num).await
    }

    pub async fn get_chunk(&self, track_index: u32, configuration: String, chunk: u32) -> Result<PathBuf, StreamingError> {
        let preset_ref = PresetRef::new(track_index, configuration, self.stream_state.source.clone());
        let preset = self.preset_pool.find_or_create_preset(&preset_ref).await?;
        let track = self.tracks.get(track_index as usize).ok_or(StreamingError::new(ErrorKind::NoTrack(track_index)))?;
        preset.get_chunk(track, chunk).await
    }

    pub async fn kill(&self) -> Result<(), StreamingError> {
        for track in &self.tracks {
            for (_, preset) in track.get_presets() {
                let preset_ref = PresetRef::new(track.output_track(), preset.to_string(), self.stream_state.source.clone());
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