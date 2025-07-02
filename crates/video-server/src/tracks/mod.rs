use crate::media_info::TrackInfo;
use crate::video_avc::{get_avc1_tag, level_to_tag};
use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use std::sync::Arc;
use xmlwriter::XmlWriter;
use crate::error::StreamingError;
use crate::media::MediaState;

pub mod audio_transcode;
pub mod video_transcode;

#[derive(Debug, Clone)]
pub enum ContentType {
    Video,
    Audio,
    Subtitles,
}

impl ContentType {
    pub fn mime(&self) -> &str {
        match self {
            ContentType::Video => {"video/mp4"}
            ContentType::Audio => {"audio/mp4"}
            ContentType::Subtitles => {"unknown/unknown"}
        }
    }
}

impl Display for ContentType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            ContentType::Video => "video",
            ContentType::Audio => "audio",
            ContentType::Subtitles => "subtitles",
        })
    }
}

pub struct TrackConfig {
    pub media_state: Arc<MediaState>,
    pub input_track: u32,
    pub output_track: u32,
    pub force_transcoding: bool,
    pub default: bool,
    pub args: HashMap<String, String>,
}

impl TrackConfig {
    pub fn new(media_state: Arc<MediaState>, input_track: u32, output_track: u32) -> Self {
        Self {
            media_state,
            force_transcoding: false,
            input_track,
            output_track,
            args: Default::default(),
            default: false,
        }
    }
    pub fn force_transcoding(mut self, force_transcoding: bool) -> Self {
        self.force_transcoding = force_transcoding;
        self
    }
    pub fn default(mut self, default: bool) -> Self {
        self.default = default;
        self
    }
    pub fn arg(mut self, key: String, value: String) -> Self {
        self.args.insert(key, value);
        self
    }

    pub fn track_info(&self) -> Result<&TrackInfo, StreamingError> {
        self.media_state.info().get_track(self.input_track)
    }
}

pub trait Track: Send + Sync {
    fn config(&self) -> &TrackConfig;
    fn build_manifest(
        &self,
        w: &mut XmlWriter,
        start_num: u32,
        media_bitrate: Option<u64>,
    ) -> Result<(), StreamingError> {
        let infos = self.config().track_info()?;

        let bitrate = infos.get_bitrate().or(media_bitrate).unwrap_or(10_000_000);

        // Each audio stream must be in a separate adaptation set otherwise they are treated as
        // different bitrates of the same track rather than separate tracks.
        w.start_element("AdaptationSet");
        {
            w.write_attribute("contentType", &self.content_type().to_string());
            w.write_attribute("id", &self.config().output_track); // stream index

            // write segment template
            w.start_element("SegmentTemplate");
            {
                w.write_attribute("timescale", &1);
                w.write_attribute("duration", &5);
                w.write_attribute(
                    "initialization",
                    &format!("/api/stream/{}/init/{}/{start_num}", self.config().media_state.stream_id(), self.config().output_track),
                );
                w.write_attribute("media", &format!("/api/stream/{}/data/{}/$Number$", self.config().media_state.stream_id(), self.config().output_track));
                w.write_attribute("startNumber", &start_num);
            }
            // close SegmentTemplate and Representation
            w.end_element();

            // write representations
            w.start_element("Representation");
            {
                let video_avc = infos
                    .level
                    .and_then(|x| level_to_tag(x))
                    .unwrap_or(get_avc1_tag(
                        infos.width.clone().unwrap_or(1920) as u64,
                        infos.height.clone().unwrap_or(1080) as u64,
                        bitrate,
                        24,
                    ));

                w.write_attribute("id", &self.config().media_state.stream_id());
                w.write_attribute("codecs", &if let ContentType::Audio = self.content_type() { "mp4a.40.2".to_string() } else { video_avc.to_string() });
                w.write_attribute("bandwidth", &bitrate);
                w.write_attribute("mimeType", self.content_type().mime());
                for (k, v) in self.config().args.iter() {
                    w.write_attribute(k, v);
                }

                // mark the default video track
                if self.config().default {
                    w.start_element("Role");
                    {
                        w.write_attribute("schemeIdUri", "urn:mpeg:dash:role:2011");
                        w.write_attribute("value", "main");
                    }
                    w.end_element();
                }
            }
            w.end_element();
        }
        // close AdaptationSet
        w.end_element();
        Ok(())
    }
    fn build_args(&self, start_num: u32) -> Result<Vec<String>, StreamingError>;
    fn content_type(&self) -> ContentType;
}
