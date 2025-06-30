use crate::media_info::TrackInfo;
use crate::stream_id::StreamId;
use crate::video_avc::{get_avc1_tag, level_to_tag};
use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use std::io;
use std::io::Error;
use xmlwriter::XmlWriter;

pub mod audio_transcode;
pub mod video_transcode;
pub mod video_transmux;

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

pub trait Track: Send + Sync {
    fn get_infos(&self) -> Result<&TrackInfo, Error>;
    fn output_track(&self) -> u32;
    fn stream_id(&self) -> &StreamId;
    fn is_default(&self) -> bool;
    fn args(&self) -> &HashMap<String, String>;
    fn build_manifest(
        &self,
        w: &mut XmlWriter,
        start_num: u32,
        media_bitrate: Option<u64>,
    ) -> Result<(), Error> {
        let infos = self.get_infos()?;

        let bitrate = infos.get_bitrate().or(media_bitrate).unwrap_or(10_000_000);

        // Each audio stream must be in a separate adaptation set otherwise they are treated as
        // different bitrates of the same track rather than separate tracks.
        w.start_element("AdaptationSet");
        {
            w.write_attribute("contentType", &self.content_type().to_string());
            w.write_attribute("id", &self.output_track()); // stream index

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

                w.write_attribute("id", &self.stream_id());
                w.write_attribute("bandwidth", &bitrate);
                w.write_attribute("mimeType", self.content_type().mime());
                w.write_attribute("codecs", &if let ContentType::Audio = self.content_type() { "mp4a.40.2".to_string() } else { video_avc.to_string() });

                for (k, v) in self.args().iter() {
                    w.write_attribute(k, v);
                }

                // mark the default video track
                if self.is_default() {
                    w.start_element("Role");
                    {
                        w.write_attribute("schemeIdUri", "urn:mpeg:dash:role:2011");
                        w.write_attribute("value", "main");
                    }
                    w.end_element();
                }

                // write segment template
                w.start_element("SegmentTemplate");
                {
                    w.write_attribute("timescale", &1);
                    w.write_attribute("duration", &10);
                    w.write_attribute(
                        "initialization",
                        &format!("init/{}/{start_num}", self.output_track()),
                    );
                    w.write_attribute("media", &format!("data/{}/$Number$", self.output_track()));
                    w.write_attribute("startNumber", &start_num);
                }
                // close SegmentTemplate and Representation
                w.end_element();
            }
            w.end_element();
        }
        // close AdaptationSet
        w.end_element();
        Ok(())
    }
    fn build_args(&self, start_num: u32) -> Result<Vec<String>, io::Error>;
    fn content_type(&self) -> ContentType;
}
