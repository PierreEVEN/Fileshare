use crate::error::{ErrorKind, StreamingError};
use crate::media_stream::track_preset::{Framerate, TrackPreset};
use std::collections::HashSet;
use std::sync::Arc;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;
use types::database_ids::ItemId;
use crate::media_info::CodecType;

pub struct StreamTrack {
    presets: HashSet<TrackPreset>,
    global_config: Arc<VideoServerConfig>,
    definition: TrackDefinition,
    output_track: u32,
    input_item: ItemId
}

pub struct TrackDefinition {
    pub input_bitrate: u32,
    pub input_duration: f32,
    pub input_height: u32,
    pub input_width: u32,
    pub input_framerate: Framerate,
    pub codec_type: CodecType,
    pub level: u32
}

impl StreamTrack {
    pub fn compile_manifest(&self, w: &mut XmlWriter, start_num: u32) -> Result<(), StreamingError> {
        w.start_element("AdaptationSet");
        {
            w.write_attribute("mimeType", self.definition.codec_type.mime());
            w.write_attribute("contentType", &self.definition.codec_type.to_string());
            w.write_attribute("subsegmentAlignment", &true);

            w.start_element("SegmentTemplate");
            {
                w.write_attribute("duration", &self.global_config.segment_duration_sec);
                w.write_attribute("timescale", &1);
                w.write_attribute("media", &format!("/api/stream/{}/data/{}/$RepresentationID$/$Number$", self.input_item, self.output_track));
                w.write_attribute("startNumber", &start_num);
                w.write_attribute("initialization", &format!("/api/stream/{}/init/{}/$RepresentationID$/{start_num}", self.input_item, self.output_track));
            }
            w.end_element();

            for preset in &self.presets {
                let description = preset.description();
                let codec = match &self.definition.codec_type {
                    CodecType::Audio => "mp4a.40.2".to_string(),
                    CodecType::Video => {
                        let avc1_tag = preset.avc1_level().ok_or(StreamingError::new(ErrorKind::MissingData("Level")))?;
                        avc1_tag.to_string()
                    }
                    v => { return Err(StreamingError::new(ErrorKind::ParseError(format!("Unhandled codec type {v}", )))) }
                };

                w.start_element("Representation");
                {
                    w.write_attribute("id", &preset.to_string());
                    w.write_attribute("codecs", &codec);
                    w.write_attribute("bandwidth", &preset.bitrate());

                    if description.is_default {
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