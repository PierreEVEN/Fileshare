use std::cmp::Ordering;
use crate::media_info::CodecType;
use crate::media_stream::stream_track::TrackDefinition;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use std::ops::Deref;
use crate::media_stream::video_avc::{avc1_level_to_tag, find_avc1_level, Avc1Level};

pub struct TrackPreset {
    description: PresetDescription,
    parent_track: TrackDefinition,
}

impl TrackPreset {
    pub fn new(description: PresetDescription, parent_track: TrackDefinition) -> Self {
        Self {
            description,
            parent_track,
        }
    }

    pub fn description(&self) -> &PresetDescription {
        &self.description
    }

    pub fn height(&self) -> u32 {
        match self.description.data {
            PresetDescriptionData::Video { max_height, .. } => {
                max_height.unwrap_or(u32::MAX).min(self.parent_track.input_height)
            }
            _ => 0,
        }
    }

    pub fn width(&self) -> u32 {
        match self.description.data {
            PresetDescriptionData::Video { max_height, .. } => {
                match max_height {
                    None => {self.parent_track.input_width}
                    Some(max_height) => {
                        let ratio = max_height  as f32 / self.parent_track.input_height as f32;
                        (self.parent_track.input_width as f32 * ratio) as u32
                    }
                }
            }
            _ => 0,
        }
    }

    pub fn bitrate(&self) -> u32 {
        match self.description.data {
            PresetDescriptionData::Audio { max_bitrate, .. } => {
                max_bitrate.unwrap_or(u32::MAX).min(self.parent_track.input_bitrate)
            }
            PresetDescriptionData::Video { max_bitrate, .. } => {
                max_bitrate.unwrap_or(u32::MAX).min(self.parent_track.input_bitrate)
            }
            PresetDescriptionData::Subtitle { .. } => 0,
        }
    }

    pub fn framerate(&self) -> Framerate {
        match &self.description.data {
            PresetDescriptionData::Video { max_frame_rate, .. } => {
                max_frame_rate.unwrap_or(Framerate::MAX).min(self.parent_track.input_framerate)
            }
            _ => Framerate(0f32),
        }
    }

    pub fn avc1_level(&self) -> Option<Avc1Level> {
        avc1_level_to_tag(find_avc1_level(self.width(), self.height(), self.bitrate(), self.framerate()))
    }
}

impl Eq for TrackPreset {}

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


#[derive(Clone, Copy)]
pub struct Framerate(f32);

impl Deref for Framerate {
    type Target = f32;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Framerate {
    pub const MAX: Framerate = Framerate(f32::MAX);
}

impl Eq for Framerate {}
impl Ord for Framerate {
    fn cmp(&self, other: &Self) -> Ordering {
        if self.0 < other.0 {
            Ordering::Less
        } else if self.0 > other.0 {
            Ordering::Greater
        } else {
            Ordering::Equal
        }
    }
}
impl PartialOrd for Framerate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl PartialEq for Framerate {
    fn eq(&self, other: &Self) -> bool {
        self.0.eq(&other.0)
    }
}

#[derive(Clone, Eq, PartialEq)]
pub enum PresetDescriptionData {
    Video {
        max_bitrate: Option<u32>,
        max_height: Option<u32>,
        max_frame_rate: Option<Framerate>,
    },
    Audio {
        max_bitrate: Option<u32>,
        max_channels: Option<u32>,
    },
    Subtitle {
        name: String,
    },
}

#[derive(Clone, PartialEq, Eq)]
pub struct PresetDescription {
    pub codec: CodecType,
    pub label: &'static str,
    pub is_default: bool,
    pub data: PresetDescriptionData,
}

impl Hash for PresetDescription {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.codec.hash(state);
        self.label.hash(state);
    }
}

impl Display for PresetDescription {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!("{}_{}", self.codec, self.label.replace(" ", "_")))
    }
}

impl Display for TrackPreset {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.description.fmt(f)
    }
}
