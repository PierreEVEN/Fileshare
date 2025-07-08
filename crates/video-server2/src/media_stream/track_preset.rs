use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use crate::media_info::CodecType;

#[derive(Eq)]
pub struct TrackPreset {
    description: PresetDescription,
}

impl PartialEq for TrackPreset {
    fn eq(&self, other: &Self) -> bool {
        self.description == other.description
    }
}

impl Hash for TrackPreset {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.description.hash(state)
    }
}

#[derive(Clone, PartialEq, Eq)]
enum PresetDescriptionData {
    Audio {
        max_bitrate: u64,
        max_height: u32,
        max_frame_rate: u32
    },
    Video {
        bitrate: u64,
        channels: u32
    },
    Subtitle {
        name: String
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct PresetDescription {
    codec: CodecType,
    label: &'static str,
    is_default: bool,
    data: PresetDescriptionData
}

impl Hash for PresetDescription {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.codec.hash(state);
        self.label.hash(state);
    }
}

impl Display for TrackPreset {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        todo!()
    }
}