use crate::error::StreamingError;
use crate::stream::StreamState;
use crate::tracks::presets::track_preset::TrackPreset;
use crate::tracks::TrackState;

pub struct Track {
    owning_stream: StreamState,
}

impl Track {

    fn build_args(&self, start_num: u32, preset: TrackPreset) -> Result<Vec<String>, StreamingError> {
        
    }
}