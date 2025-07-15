use crate::error::{ErrorKind, StreamingError};
use crate::media_info::media_info::{CodecType, Framerate, MediaInfo};
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::preset_description::PresetDescription;
use crate::media_stream::track_preset::TrackPreset;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;

pub struct StreamTrack {
    presets: RwLock<HashMap<PresetDescription, Arc<TrackPreset>>>,
    global_config: Arc<VideoServerConfig>,
    definition: Arc<TrackDefinition>,
    output_track: u32,
    stream_reference: StreamReference
}

pub struct TrackDefinition {
    pub input_bitrate: u32,
    pub input_duration: f32,
    pub input_height: u32,
    pub input_width: u32,
    pub input_framerate: Framerate,
    pub codec_type: CodecType,
    pub codec: Option<String>,
    pub level: u32,
    pub pixel_format: Option<String>,
    pub index: u32
}

impl TrackDefinition {
    pub fn new(source_media: &MediaInfo, track_index: u32) -> Result<Self, StreamingError> {
        let track = source_media.get_track(track_index)?;
        Ok(Self {
            input_bitrate: track.get_bitrate().unwrap_or(source_media.get_bitrate().ok_or(StreamingError::new(ErrorKind::MissingData("bitrate")))?) as u32,
            input_duration: track.duration.as_ref().unwrap_or(&source_media.get_duration().ok_or(StreamingError::new(ErrorKind::MissingData("duration")))?.to_string()).parse::<f32>()?,
            input_height: if let CodecType::Video = track.codec_type()? {track.height.ok_or(StreamingError::new(ErrorKind::MissingData("height")))? as u32} else {0},
            input_width: if let CodecType::Video = track.codec_type()? {track.width.ok_or(StreamingError::new(ErrorKind::MissingData("width")))? as u32} else {0},
            input_framerate: if let CodecType::Video = track.codec_type()? {track.get_framerate()?} else {Framerate::from(0f32)},
            codec_type: track.codec_type()?,
            codec: track.codec_name.clone(),
            level: if let CodecType::Video = track.codec_type()? {track.level.unwrap_or(0) as u32} else {0},
            pixel_format: track.pix_fmt.clone(),
            index: track.index as u32,
        })
    }
}

impl StreamTrack {
    pub fn new(global_config: Arc<VideoServerConfig>, stream_reference: StreamReference, input_definition: TrackDefinition, output_track: u32) -> Self {
        Self {
            presets: Default::default(),
            global_config,
            definition: Arc::new(input_definition),
            output_track,
            stream_reference,
        }
    }

    pub async fn get_or_create_preset(&self, preset: &PresetDescription) -> Result<Arc<TrackPreset>, StreamingError> {
        // Try get read only
        if let Some(preset) = self.presets.read().await.get(preset) {
            return Ok(preset.clone());
        }

        // Get or create preset
        let mut presets = self.presets.write().await;
        if let Some(preset) = presets.get(preset) {
            return Ok(preset.clone());
        }

        let new_preset = Arc::new(TrackPreset::new(self.global_config.clone(), self.output_track, self.stream_reference.clone(), preset.clone(), self.definition.clone())?);
        presets.insert(preset.clone(), new_preset.clone());
        Ok(new_preset)
    }

    pub async fn compile_manifest(&self, w: &mut XmlWriter, start_num: u32) -> Result<(), StreamingError> {
        w.start_element("AdaptationSet");
        {
            w.write_attribute("mimeType", self.definition.codec_type.mime());
            w.write_attribute("contentType", &self.definition.codec_type.to_string());
            w.write_attribute("subsegmentAlignment", &true);

            w.start_element("SegmentTemplate");
            {
                w.write_attribute("duration", &self.global_config.segment_duration_sec);
                w.write_attribute("timescale", &1);
                w.write_attribute("media", &format!("/api/stream/{}/data/{}/$Number$?$RepresentationID$", self.stream_reference.id(), self.output_track));
                w.write_attribute("startNumber", &start_num);
                w.write_attribute("initialization", &format!("/api/stream/{}/init/{}/{start_num}?$RepresentationID$", self.stream_reference.id(), self.output_track));
            }
            w.end_element();

            let mut is_first = true;

            for description in PresetDescription::from_track(&self.definition) {
                let codec = match &self.definition.codec_type {
                    CodecType::Audio => "mp4a.40.2".to_string(),
                    CodecType::Video => {
                        let avc1_tag = description.avc1_level(self.definition.as_ref()).ok_or(StreamingError::new(ErrorKind::MissingData("Level")))?;
                        avc1_tag.to_string()
                    }
                    v => { return Err(StreamingError::new(ErrorKind::ParseError(format!("Unhandled codec type {v}", )))) }
                };

                w.start_element("Representation");
                {
                    w.write_attribute("id", &description.to_string());
                    w.write_attribute("codecs", &codec);
                    w.write_attribute("bandwidth", &description.bitrate(self.definition.as_ref()));

                    if is_first {
                        is_first = false;
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

    pub async fn destroy(&self) -> Result<(), StreamingError> {
        Ok(())
    }
}