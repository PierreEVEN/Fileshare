use crate::error::{ErrorKind, StreamingError};
use crate::media_stream::track_preset::TrackPreset;
use std::collections::HashSet;
use std::sync::Arc;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;

pub struct StreamTrack {
    presets: HashSet<TrackPreset>,
    global_config: Arc<VideoServerConfig>,
    label: String,
}

impl StreamTrack {
    pub fn compile_manifest(&self, w: &mut XmlWriter, start_num: u32) -> Result<(), StreamingError> {
        let media_info = self.owning_stream.media_info();
        let track_info = media_info.get_track(self.input_track)?;
        let bitrate = track_info.get_bitrate().or(media_info.get_bitrate()).unwrap_or(10_000_000);

        w.start_element("AdaptationSet");
        {
            w.write_attribute("mimeType", track_info.codec_type()?.mime());
            w.write_attribute("contentType", &track_info.codec_type);
            w.write_attribute("subsegmentAlignment", &true);

            w.start_element("SegmentTemplate");
            {
                w.write_attribute("duration", &self.global_config.segment_duration_sec);
                w.write_attribute("timescale", &1);
                w.write_attribute("media", &format!("/api/stream/{}/data/{}/$RepresentationID$/$Number$", self.owning_stream.stream_id(), self.output_track));
                w.write_attribute("startNumber", &start_num);
                w.write_attribute("initialization", &format!("/api/stream/{}/init/{}/$RepresentationID$/{start_num}", self.owning_stream.stream_id(), self.output_track));
            }
            w.end_element();

            for preset in &self.presets {
                let codec = match track_info.codec_type.as_str() {
                    "audio" => "mp4a.40.2".to_string(),
                    "video" => {
                        let video_avc = track_info
                            .level
                            .and_then(|x| video_avc::level_to_tag(x))
                            .unwrap_or(video_avc::get_avc1_tag(
                                track_info.width.clone().unwrap_or(1920) as u64,
                                track_info.height.clone().unwrap_or(1080) as u64,
                                preset.get_bitrate(track_info) as u64,
                                24,
                            ));
                        video_avc.to_string()
                    }
                    v => { return Err(StreamingError::new(ErrorKind::ParseError(format!("Unhandled codec type {v}", )))) }
                };

                w.start_element("Representation");
                {
                    w.write_attribute("id", &preset.to_string());
                    w.write_attribute("codecs", &codec);
                    w.write_attribute("bandwidth", &bitrate);

                    if self.default {
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
        }
        w.end_element();
        Ok(())
    }

}