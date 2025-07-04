use crate::error::{ErrorKind, StreamingError};
use crate::media_info::MediaTrackInfo;
use std::fmt::{Display, Formatter};

pub struct PresetDescription {
    pub name: &'static str,
    pub max_height: Option<u32>,
    pub max_bitrate: Option<u32>,
    pub max_frame_rate: Option<f32>,
    pub max_channels: Option<u8>,
}

impl PresetDescription {
    pub fn new_video(
        name: &'static str,
        max_height: Option<u32>,
        max_bitrate: Option<u32>,
        max_frame_rate: Option<f32>
    ) -> Result<Self, StreamingError> {
        Ok(Self {
            max_height,
            name,
            max_bitrate,
            max_frame_rate,
            max_channels: None,
        })
    }
    pub fn new_audio(
        name: &'static str,
        max_channels: Option<u8>,
        max_bitrate: Option<u32>
    ) -> Result<Self, StreamingError> {
        Ok(Self {
            name,
            max_channels,
            max_bitrate,
            max_height: None,
            max_frame_rate: None,
        })
    }

    pub fn create_presets(info: &MediaTrackInfo) -> Result<Vec<Self>, StreamingError> {
        let mut presets = vec![];

        if info.codec_type == "video" {
            let height = info
                .height
                .ok_or(StreamingError::new(ErrorKind::MissingData("height")))?;

            let low_fps = if info.get_framerate()? <= 30. { None } else {Some(30.)};

            if height >= 144 {
                presets.push(PresetDescription::new_video("144p", Some(144), Some(200_000), low_fps)?);
            }
            if height >= 240 {
                presets.push(PresetDescription::new_video("240p", Some(240), Some(400_000), low_fps)?);
            }
            if height >= 360 {
                presets.push(PresetDescription::new_video("360p", Some(360), Some(1_000_000), low_fps)?);
            }
            if height >= 468 {
                presets.push(PresetDescription::new_video("SD 468p", Some(468), Some(1_000_000), low_fps)?);
            }
            if height >= 720 {
                presets.push(PresetDescription::new_video("HD 720p", Some(720), Some(500_000), low_fps)?);
            }
            if height >= 1080 {
                presets.push(PresetDescription::new_video("Full HD 1080p", Some(1080), Some(8_000_000), low_fps)?);
            }
            if height >= 1440 {
                presets.push(PresetDescription::new_video("QHD 2K", Some(1440), Some(16_000_000), low_fps)?);
            }
            if height >= 2160 {
                presets.push(PresetDescription::new_video("UHD 4K", Some(2160), Some(35_000_000), low_fps)?);
            }
            if height >= 4320 {
                presets.push(PresetDescription::new_video("UHD 8K", Some(4320), Some(80_000_000), low_fps)?);
            }
            presets.push(PresetDescription::new_video("Source", Some(height as u32), None, None)?);
        } else if info.codec_type == "audio" {
            presets.push(PresetDescription::new_audio("Source", None, None)?);
        }
        Ok(presets)
    }

    pub fn get_bitrate(&self, track_info: &MediaTrackInfo) -> u32 {
        match self.max_bitrate {
            None => { track_info.get_bitrate().unwrap_or(8_000_000) as u32 }
            Some(max_bitrate) => { max_bitrate }
        }
    }

    pub fn get_framerate(&self, track_info: &MediaTrackInfo) -> f32 {
        let frame_rate = track_info.get_framerate().unwrap_or(25.);
        match self.max_frame_rate {
            None => { frame_rate }
            Some(max_frame_rate) => { if max_frame_rate < frame_rate { max_frame_rate } else { frame_rate } }
        }
    }

    pub fn get_height(&self, track_info: &MediaTrackInfo) -> u32 {
        let track_height = track_info.height.unwrap_or(720) as u32;
        match self.max_height {
            None => { track_height }
            Some(max_height) => { if max_height < track_height { max_height} else { track_height } }
        }
    }

    pub fn get_width(&self, track_info: &MediaTrackInfo) -> u32 {
        let height = self.get_height(track_info);
        let base_height = track_info.height.unwrap_or(1280) as u32;
        let track_width = track_info.width.unwrap_or(1280) as u32;
        (height as f32 / base_height as f32 * track_width as f32) as u32
    }
}

impl Display for PresetDescription {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut format = String::new();
        if let Some(height) = self.max_height { format += format!("{height}p ").as_str(); }
        if let Some(bitrate) = self.max_bitrate { format += format!("{}kbps ", bitrate / 1000).as_str(); }
        if let Some(framerate) = self.max_frame_rate { format += format!("{framerate}fps ").as_str(); }
        format.trim().replace(" ", "_").fmt(f)
    }
}
