use crate::error::{ErrorKind, StreamingError};
use crate::media_info::MediaTrackInfo;
use std::fmt::{Display, Formatter};

pub enum TrackPreset {
    Video{
        height: u32,
        name: &'static str,
        max_bitrate: Option<u32>,
        max_frame_rate: Option<f32>
    },
    Audio {
        name: &'static str,
        max_channels: Option<u8>,
        max_bitrate: Option<u32>,
    }
}

impl TrackPreset {
    pub fn new_video(
        name: &'static str,
        height: u32,
        max_bitrate: Option<u32>,
        max_frame_rate: Option<f32>
    ) -> Result<Self, StreamingError> {
        Ok(Self::Video {
            height,
            name,
            max_bitrate,
            max_frame_rate
        })
    }
    pub fn new_audio(
        name: &'static str,
        max_channels: Option<u8>,
        max_bitrate: Option<u32>
    ) -> Result<Self, StreamingError> {
        Ok(Self::Audio {
            name,
            max_channels,
            max_bitrate
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
                presets.push(TrackPreset::new_video("144p", 144, Some(200_000), low_fps)?);
            }
            if height >= 240 {
                presets.push(TrackPreset::new_video("240p", 240, Some(400_000), low_fps)?);
            }
            if height >= 360 {
                presets.push(TrackPreset::new_video("360p", 360, Some(1_000_000), low_fps)?);
            }
            if height >= 468 {
                presets.push(TrackPreset::new_video("SD 468p", 468, Some(1_000_000), low_fps)?);
            }
            if height >= 720 {
                presets.push(TrackPreset::new_video("HD 720p", 720, Some(500_000), low_fps)?);
            }
            if height >= 1080 {
                presets.push(TrackPreset::new_video("Full HD 1080p", 1080, Some(8_000_000), low_fps)?);
            }
            if height >= 1440 {
                presets.push(TrackPreset::new_video("QHD 2K", 1440, Some(16_000_000), low_fps)?);
            }
            if height >= 2160 {
                presets.push(TrackPreset::new_video("UHD 4K", 2160, Some(35_000_000), low_fps)?);
            }
            if height >= 4320 {
                presets.push(TrackPreset::new_video("UHD 8K", 4320, Some(80_000_000), low_fps)?);
            }
            presets.push(TrackPreset::new_video("Source", height as u32, None, None)?);
        } else if info.codec_type == "audio" {
            presets.push(TrackPreset::new_audio("Source", None, None)?);
        }
        Ok(presets)
    }
}

impl Display for TrackPreset {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            TrackPreset::Video { height, max_bitrate, max_frame_rate, .. } => {
                f.write_fmt(format_args!("{}p", height))?;
                if let Some(bitrate) = max_bitrate {f.write_fmt(format_args!("_{bitrate}bps"))?;}
                if let Some(framerate) = max_frame_rate {f.write_fmt(format_args!("_{framerate}fps"))?;}
            }
            TrackPreset::Audio { .. } => {
                f.write_fmt(format_args!("audio"))?;
            }
        }
        Ok(())
    }
}
