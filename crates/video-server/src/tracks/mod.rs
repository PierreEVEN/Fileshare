use crate::media_info::MediaTrackInfo;
use std::collections::HashMap;
use std::sync::Arc;
use xmlwriter::XmlWriter;
use crate::error::StreamingError;
use presets::track_preset::TrackPreset;
use crate::stream::StreamState;
use crate::tracks::content_type::ContentType;
use crate::tracks::utils::video_avc::{get_avc1_tag, level_to_tag};

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
