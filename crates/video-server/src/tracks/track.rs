use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::info;
use xmlwriter::XmlWriter;
use crate::error::{ErrorKind, StreamingError};
use crate::stream::StreamState;
use crate::tracks::presets::track_preset::TrackPreset;
use crate::tracks::utils::is_supported_html5_codec;
use crate::tracks::utils::video_avc::{get_avc1_tag, level_to_tag};

pub struct Track {
    owning_stream: Arc<StreamState>,
    input_track: u32,
    output_track: u32,
    default: bool,
    args: HashMap<String, String>,
    presets: HashMap<String, TrackPreset>,
    target_gop: u32,
    force_transcoding: bool,
}

impl Track {
    pub fn new(owning_stream: Arc<StreamState>, input_track: u32, output_track: u32) -> Self {
        Self {
            owning_stream,
            input_track,
            output_track,
            default: false,
            args: Default::default(),
            presets: Default::default(),
            target_gop: 5,
            force_transcoding: false,
        }
    }

    pub fn compile_manifest(&self, w: &mut XmlWriter, start_num: u32) -> Result<(), StreamingError> {
        let media_info = self.owning_stream.media_info();
        let track_info = media_info.get_track(self.input_track)?;
        let bitrate = track_info.get_bitrate().or(media_info.get_bitrate()).unwrap_or(10_000_000);

        w.start_element("AdaptationSet");
        {
            w.write_attribute("mimeType", match track_info.codec_type.as_str() {
                "audio" => "audio/mp4",
                "video" => "video/mp4",
                &v => { return Err(StreamingError::new(ErrorKind::ParseError(format!("Unhandled codec type {v}", )))) }
            });
            w.write_attribute("contentType", &track_info.codec_type);
            w.write_attribute("subsegmentAlignment", &true);

            w.start_element("SegmentTemplate");
            {
                w.write_attribute("duration", &self.target_gop);
                w.write_attribute("timescale", &1);
                w.write_attribute("media", &format!("/api/stream/{}/data/{}/$RepresentationID$/$Number$", self.owning_stream.stream_id(), self.output_track));
                w.write_attribute("startNumber", &start_num);
                w.write_attribute("initialization", &format!("/api/stream/{}/init/{}/$RepresentationID$/{start_num}", self.owning_stream.stream_id(), self.output_track));
            }
            w.end_element();

            for (preset_id, preset) in &self.presets {
                let codec = match track_info.codec_type.as_str() {
                    "audio" => "mp4a.40.2".to_string(),
                    "video" => {
                        let video_avc = track_info
                            .level
                            .and_then(|x| level_to_tag(x))
                            .unwrap_or(get_avc1_tag(
                                track_info.width.clone().unwrap_or(1920) as u64,
                                track_info.height.clone().unwrap_or(1080) as u64,
                                preset.bitrate,
                                24,
                            ));
                        video_avc.to_string()
                    }
                    &v => { return Err(StreamingError::new(ErrorKind::ParseError(format!("Unhandled codec type {v}", )))) }
                };

                w.start_element("Representation");
                {
                    w.write_attribute("id", &preset_id);
                    w.write_attribute("codecs", &codec);
                    w.write_attribute("bandwidth", &bitrate);
                    for (k, v) in self.args.iter() {
                        w.write_attribute(k, v);
                    }

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

    pub fn should_transcode(&self, preset: &TrackPreset) -> Result<bool, StreamingError> {
        if self.force_transcoding { return Ok(true); }
        let media_info = self.owning_stream.media_info();
        let track_info = media_info.get_track(self.input_track)?;

        match &track_info.codec_name {
            Some(codec) => if !is_supported_html5_codec(codec.as_str()) { return Ok(true) }
            None => return Ok(true)
        }

        Ok(false)
    }

    fn build_args(&self, start_num: u32, preset: &TrackPreset) -> Result<Vec<String>, StreamingError> {
        let init_seg = if cfg!(target_os = "windows") {
            self.owning_stream.init_seg(start_num, self.output_track)?
        } else {
            PathBuf::from(self.owning_stream.init_seg(start_num, self.output_track)?.file_name().unwrap())
        };

        let segment_name = self.owning_stream.chunk_path(self.output_track)?;
        let outdir = self.owning_stream.playlist_path(self.output_track)?;

        let mut args = vec![
            "-y".into(),
            "-ss".into(), (start_num * self.target_gop).to_string(),
            "-i".into(), self.owning_stream.source().to_str().unwrap().into(),
            "-map".into(), format!("0:{}", self.input_track),
        ];

        // Directly copy stream everytime it's possible to save CPU usage
        if self.should_transcode(preset)? {
            info!("Stream {}:{} is using full video transcoding", self.owning_stream.stream_id(), self.output_track);
            if let Some(height) = height {
                args.append(vec!["-vf".into(), format!("scale={}:{}", height, width)]);
            }

            if let Some(bitrate) = bitrate {
                args.push("-b:v".into());
                args.push(bitrate.to_string());
            }

            args.append(&mut vec![
                "-c:0".into(), "h264".into(),
                "-preset".into(), "veryfast".into(),
            ]);
        } else {
            args.append(&mut vec!["-c:0".into(), "copy".into()]);
        }

        args.append(&mut vec![
            "-start_at_zero".into(), "-copyts".into(),
            "-fps_mode".into(), "passthrough".into(),
            "-avoid_negative_ts".into(), "make_non_negative".into(),
            "-max_muxing_queue_size".into(), "2048".into()
        ]);

        args.append(&mut vec!["-f".into(), "hls".into(), "-start_number".into(), start_num.to_string()]);

        // these args are needed if we start a new stream in the middle of a old one, such as when
        // seeking. These args will reset the base decode ts to equal the earliest presentation
        // timestamp.
        if start_num > 0 {
            args.append(&mut vec!["-hls_segment_options".into(), "movflags=frag_custom+dash+delay_moov+frag_discont".into()])
        } else {
            args.append(&mut vec!["-hls_segment_options".into(), "movflags=frag_custom+dash+delay_moov".into()])
        }

        // needed so that in progress segments are named `tmp` and then renamed after the data is
        // on disk.
        // This in theory practically prevents the web server from returning a segment that is
        // in progress.
        args.append(&mut vec!["-hls_flags".into(), "temp_file".into(), "-max_delay".into(), "5000000".into()]);

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg.display().to_string()]);
        args.append(&mut vec!["-hls_time".into(), self.target_gop.to_string()]);
        args.append(&mut vec!["-force_key_frames".into(), format!("expr:gte(t,n_forced*{})", self.target_gop)]);

        args.append(&mut vec!["-hls_segment_type".into(), "1".into()]);
        args.append(&mut vec!["-loglevel".into(), "warning".into(), "-progress".into(), "pipe:1".into()]);
        args.append(&mut vec!["-hls_segment_filename".into(), segment_name.display().to_string()]);
        args.append(&mut vec![outdir.display().to_string()]);
        Ok(args)
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
}