use crate::error::StreamingError;
use crate::media_stream::preset_description::PresetDescription;
use crate::media_stream::stream_track::TrackDefinition;
use std::path::PathBuf;
use std::sync::Arc;

pub struct TrackPreset {
    description: PresetDescription,
    parent_track: Arc<TrackDefinition>,
}

impl TrackPreset {
    pub fn new(description: PresetDescription, parent_track: Arc<TrackDefinition>) -> Self {
        Self {
            description,
            parent_track,
        }
    }

    pub fn description(&self) -> &PresetDescription {
        &self.description
    }

    pub async fn get_init(&self, _num: u32) -> Result<PathBuf, StreamingError> {
        todo!()
    }

    pub async fn get_chunk(&self, _num: u32) -> Result<PathBuf, StreamingError> {
        todo!()
    }
}