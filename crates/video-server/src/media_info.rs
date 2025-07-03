use std::path::PathBuf;
use std::process::Command;
use std::str::FromStr;
use serde::{Deserialize, Serialize};
use crate::error::{ErrorKind, StreamingError};

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MediaInfo {
    streams: Vec<MediaTrackInfo>,
    format: MediaFormat,
}

impl MediaInfo {
    pub fn get_bitrate(&self) -> Option<u64> {
        self.format.bit_rate.parse::<u64>().ok()
    }
    
    pub fn get_duration(&self) -> Option<i32> {
        Some(self.format.duration.parse::<f64>().ok()? as i32)
    }
    
    pub fn get_video_tracks(&self) -> Vec<u32> {
        let mut streams = vec![];
        for (index, track) in self.streams.iter().enumerate() {
            if track.codec_type == "video" {
                streams.push(index as u32);
            }
        }
        streams
    }

    pub fn get_track(&self, index: u32) -> Result<&MediaTrackInfo, StreamingError> {
        self.streams.get(index as usize).ok_or(StreamingError::new(ErrorKind::NoTrack(index)))
    }

    pub fn get_audio_tracks(&self) -> Vec<u32> {
        let mut streams = vec![];
        for (index, track) in self.streams.iter().enumerate() {
            if track.codec_type == "audio" {
                streams.push(index as u32);
            }
        }
        streams
    }
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq, Serialize)]
pub struct Disposition {
    pub default: i64,
    pub dub: i64,
    pub original: i64,
    pub comment: i64,
    pub lyrics: i64,
    pub karaoke: i64,
    pub forced: i64,
    pub hearing_impaired: i64,
    pub visual_impaired: i64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MediaTrackInfo {
    pub index: i64,
    pub codec_name: Option<String>,
    pub profile: Option<String>,
    pub codec_type: String,
    pub codec_time_base: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub coded_width: Option<i64>,
    pub coded_height: Option<i64>,
    pub display_aspect_ratio: Option<String>,
    pub is_avc: Option<String>,
    pub has_b_frames: Option<u64>,
    pub pix_fmt: Option<String>,
    pub level: Option<i64>,
    pub r_frame_rate: Option<String>,
    pub tags: Option<StreamTags>,
    pub sample_rate: Option<String>,
    pub channels: Option<i64>,
    pub channel_layout: Option<String>,
    pub bit_rate: Option<String>,
    pub duration_ts: Option<i64>,
    pub duration: Option<String>,
    pub color_range: Option<String>,
    pub color_space: Option<String>,
    pub disposition: Option<Disposition>,
}

impl MediaTrackInfo {
    pub fn get_bitrate(&self) -> Option<u64> {
        self.tags.as_ref()?.bps_eng.as_ref()?.parse::<u64>().ok()
    }

    pub fn get_framerate(&self) -> Result<f32, StreamingError> {
        match &self.r_frame_rate {
            None => {Err(StreamingError::new(ErrorKind::MissingData("r_frame_rate")))}
            Some(frame_rate) => {
                let mut split = frame_rate.split("/");
                let mut value = f32::from_str(split.next().ok_or(StreamingError::new(ErrorKind::MissingData("framerate numerator")))?).or(Err(StreamingError::new(ErrorKind::ParseError("framerate numerator".into()))))?;
                if let Some(div) = split.next() {
                    value /= f32::from_str(div).or(Err(StreamingError::new(ErrorKind::ParseError("framerate denominator".into()))))?;
                }
                Ok(value)
            }
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StreamTags {
    pub language: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "BPS-eng")]
    pub bps_eng: Option<String>,
    #[serde(rename = "DURATION-eng")]
    pub duration_eng: Option<String>,
    #[serde(rename = "NUMBER_OF_FRAMES-eng")]
    pub number_of_frames_eng: Option<String>,
    #[serde(rename = "NUMBER_OF_BYTES-eng")]
    pub number_of_bytes_eng: Option<String>,
    #[serde(rename = "_STATISTICS_WRITING_APP-eng")]
    pub statistics_writing_app_eng: Option<String>,
    #[serde(rename = "_STATISTICS_WRITING_DATE_UTC-eng")]
    pub statistics_writing_date_utc_eng: Option<String>,
    #[serde(rename = "_STATISTICS_TAGS-eng")]
    pub statistics_tags_eng: Option<String>,
    pub filename: Option<String>,
    pub mimetype: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MediaFormat {
    pub filename: String,
    pub nb_streams: i64,
    pub nb_programs: i64,
    pub format_name: String,
    pub format_long_name: String,
    pub start_time: String,
    pub duration: String,
    pub size: String,
    pub bit_rate: String,
}

impl MediaInfo {
    #[allow(unused)]
    pub fn new(source: &PathBuf) -> Result<Self, StreamingError> {
        if !source.exists() {
            return Err(StreamingError::new(ErrorKind::Io(std::io::Error::new(std::io::ErrorKind::NotFound,"Input media file does not exists"))));
        }
        let probe = Command::new("ffprobe")
            .arg(source)
            .arg("-v")
            .arg("quiet")
            .arg("-print_format")
            .arg("json")
            .arg("-show_streams")
            .arg("-show_format")
            .output()?;

        let json = String::from_utf8_lossy(probe.stdout.as_slice());
        let result: Self = serde_json::from_str(&json)?;
        Ok(result)
    }
}