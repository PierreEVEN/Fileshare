use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use std::str::FromStr;
use serde::Deserialize;
use crate::error::{ErrorKind, StreamingError};
use crate::media_info::media_info::{CodecType, Framerate};
use crate::media_stream::stream_track::TrackDefinition;
use crate::media_stream::video_avc1::{avc1_level_to_tag, find_avc1_level, Avc1Level};

#[derive(Clone, Default, Deserialize)]
pub struct PresetDescription {
    #[serde(rename = "bitrate")]
    pub max_bitrate: Option<u32>,
    #[serde(rename = "height")]
    pub max_height: Option<u32>,
    #[serde(rename = "fps")]
    pub max_frame_rate: Option<Framerate>,
    #[serde(rename = "chan")]
    pub channels: Option<u32>,
    #[serde(rename = "lang")]
    pub language: Option<String>,
}

impl PresetDescription {
    pub fn from_track(track: &TrackDefinition) -> Vec<Self> {
        let mut presets = vec![];
        presets.push(Self::default());

        match track.codec_type {
            CodecType::Video => {
                let low_fps = if *track.input_framerate <= 30f32 { None } else {Some(Framerate::from(30f32))};
                let height = track.input_height;

                if height >= 4320 {
                    presets.push(PresetDescription {max_height: Some(4320), max_bitrate: Some(80_000_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 2160 {
                    presets.push(PresetDescription {max_height: Some(2160), max_bitrate: Some(35_000_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 1440 {
                    presets.push(PresetDescription {max_height: Some(1440), max_bitrate: Some(16_000_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 1080 {
                    presets.push(PresetDescription {max_height: Some(1080), max_bitrate: Some(8_000_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 720 {
                    presets.push(PresetDescription {max_height: Some(720), max_bitrate: Some(2_000_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 468 {
                    presets.push(PresetDescription {max_height: Some(468), max_bitrate: Some(1_000_000), max_frame_rate: low_fps, channels: None, language: None }); 
                }
                if height >= 360 {
                    presets.push(PresetDescription {max_height: Some(360), max_bitrate: Some(600_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 240 {
                    presets.push(PresetDescription {max_height: Some(240), max_bitrate: Some(400_000), max_frame_rate: low_fps, channels: None, language: None });
                }
                if height >= 144 {
                    presets.push(PresetDescription {max_height: Some(144), max_bitrate: Some(200_000), max_frame_rate: low_fps, channels: None, language: None });
                }
            }
            _ => {}
        }
        presets
    }

    pub fn from_str(source: &str) -> Result<Self, StreamingError> {
        let mut split = source.split("&");
        let mut preset = Self::default();

        while let Some(arg) = split.next() {
            let mut arg = arg.split("=");
            let key = arg.next().ok_or(StreamingError::new(ErrorKind::MissingData("Invalid preset key")))?;
            let value = arg.next().ok_or(StreamingError::new(ErrorKind::MissingData("Invalid preset value")))?;

            match key {
                "bitrate" => preset.max_bitrate = Some(u32::from_str(value)?),
                "height" => preset.max_height = Some(u32::from_str(value)?),
                "fps" => preset.max_frame_rate = Some(Framerate::from(f32::from_str(value)?)),
                "chan" => preset.channels = Some(u32::from_str(value)?),
                "lang" => preset.language = Some(value.to_string()),
                _ => {}
            }

        }

        Ok(preset)
    }

    pub fn height(&self, track: &TrackDefinition) -> u32 {
        self.max_height.unwrap_or(u32::MAX).min(track.input_height)
    }

    pub fn width(&self, track: &TrackDefinition) -> u32 {
        if track.input_height == 0 { return 0 }
        let ratio = self.height(track) as f32 / track.input_height as f32;
        (track.input_width as f32 * ratio) as u32
    }

    pub fn bitrate(&self, track: &TrackDefinition) -> u32 {
        self.max_bitrate.unwrap_or(u32::MAX).min(track.input_bitrate)
    }

    pub fn framerate(&self, track: &TrackDefinition) -> Framerate {
        self.max_frame_rate.unwrap_or(Framerate::MAX).min(track.input_framerate)
    }

    pub fn avc1_level(&self, track: &TrackDefinition) -> Option<Avc1Level> {
        avc1_level_to_tag(find_avc1_level(self.width(track), self.height(track), self.bitrate(track), self.framerate(track)))
    }
}

impl Display for PresetDescription {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut str = String::new();
        if let Some(max_bitrate) = self.max_bitrate {
            str += format!("bitrate={max_bitrate} ").as_str()
        }
        if let Some(max_height) = self.max_height {
            str += format!("height={max_height} ").as_str()
        }
        if let Some(max_frame_rate) = self.max_frame_rate {
            str += format!("fps={} ", *max_frame_rate).as_str()
        }
        if let Some(channels) = self.channels {
            str += format!("chan={channels} ").as_str()
        }
        if let Some(lang) = &self.language {
            str += format!("lang={lang} ").as_str()
        }
        str = str.trim().replace(" ", "&");
        if str.is_empty() {
            str = "Source".to_string()
        }
        f.write_str(str.as_str())
    }
}

impl Hash for PresetDescription {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.to_string().hash(state);
    }
}

impl Eq for PresetDescription {}

impl PartialEq for PresetDescription {
    fn eq(&self, other: &Self) -> bool {
        self.to_string() == other.to_string()
    }
}