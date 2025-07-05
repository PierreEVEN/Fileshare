use crate::error::StreamingError;
use crate::media_info::MediaTrackInfo;
use crate::stream::StreamState;
use std::collections::HashMap;
use std::sync::Arc;

mod utils;
pub mod content_type;
pub mod presets;
pub mod track;

pub struct TrackState {
    pub media_state: Arc<StreamState>,
    pub input_track: u32,
    pub output_track: u32,
    pub force_transcoding: bool,
    pub default: bool,
    pub args: HashMap<String, String>,
}

impl TrackState {
    pub fn new(media_state: Arc<StreamState>, input_track: u32, output_track: u32) -> Self {
        Self {
            media_state,
            force_transcoding: false,
            input_track,
            output_track,
            args: Default::default(),
            default: false,
        }
    }

    pub fn track_info(&self) -> Result<&MediaTrackInfo, StreamingError> {
        self.media_state.media_info().get_track(self.input_track)
    }
}
