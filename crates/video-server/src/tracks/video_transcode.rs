use crate::tracks::{ContentType, Track, TrackConfig};
use tracing::info;
use crate::error::StreamingError;

fn get_discont_flags(start_num: u32) -> Vec<String> {
    // these args are needed if we start a new stream in the middle of a old one, such as when
    // seeking. These args will reset the base decode ts to equal the earliest presentation
    // timestamp.
    if start_num > 0 {
        vec![
            "-hls_segment_options".into(),
            "movflags=frag_custom+dash+delay_moov+frag_discont".into(),
        ]
    } else {
        vec![
            "-hls_segment_options".into(),
            "movflags=frag_custom+dash+delay_moov".into(),
        ]
    }
}

pub struct VideoTranscodeTrack {
    config: TrackConfig,
}

impl VideoTranscodeTrack {
    pub fn new(config: TrackConfig) -> Self {
        info!(
            "stream @{} Add track {:?}:{}->{}",
            config.media_state.stream_id(),
            ContentType::Video,
            config.input_track,
            config.output_track
        );
        Self {
            config,
        }
    }
}

impl Track for VideoTranscodeTrack {
    fn config(&self) -> &TrackConfig {
        &self.config
    }

    fn build_args(&self, start_num: u32) -> Result<Vec<String>, StreamingError> {
        let target_gop = 5;
        let height: Option<i32> = None;
        let width: Option<i32> = None;
        let bitrate: Option<i32> = None;

        let init_seg = self.config().media_state.init_seg(start_num, self.config().output_track)?;
        let segment_name = self.config().media_state.chunk_path(self.config().output_track)?;
        let outdir = self.config().media_state.playlist_path(self.config().output_track)?;

        let mut args = vec![
            "-y".into(),
            "-ss".into(),
            (start_num * target_gop).to_string(),
            "-i".into(),
            self.config().media_state.source().to_str().unwrap().into(),
            "-map".into(),
            format!("0:{}", self.config().input_track),
        ];

        // Copy existing stream if it is html5-compatible
        let should_transcode = if let Some(codec) = &self.config().track_info()?.codec_name {
            match codec.as_str() {
                "h264" | "libopenh264" | "vp8" | "vp9" | "theora" | "libtheora" => false,
                &_ => true,
            }
        } else {
            true
        } || self.config().track_info()?.channels.unwrap_or(2) > 2
            || self.config.force_transcoding;

        if should_transcode {
            info!("Stream {}:{} is using full video transcoding", self.config().media_state.stream_id(), self.config().output_track);
            if let Some(height) = height {
                let width = width.unwrap_or(-2); // defaults to scaling by 2
                args.push("-vf".into());
                args.push(format!("scale={}:{}", height, width));
            }

            if let Some(bitrate) = bitrate {
                args.push("-b:v".into());
                args.push(bitrate.to_string());
            }

            args.append(&mut vec![
                "-c:0".into(),
                "h264".into(),
                "-preset".into(),
                "veryfast".into(),
            ]);
        } else {
            args.append(&mut vec!["-c:0".into(), "copy".into()]);
        }

        args.append(&mut vec![
            "-start_at_zero".into(),
            "-copyts".into(),
            "-fps_mode".into(),
            "passthrough".into(),
            "-avoid_negative_ts".into(),
            "make_non_negative".into(),
            "-max_muxing_queue_size".into(),
            "2048".into(),
        ]);

        args.append(&mut vec![
            "-f".into(),
            "hls".into(),
            "-start_number".into(),
            start_num.to_string(),
        ]);

        args.append(&mut get_discont_flags(start_num));

        // needed so that in progress segments are named `tmp` and then renamed after the data is
        // on disk.
        // This in theory practically prevents the web server from returning a segment that is
        // in progress.
        args.append(&mut vec![
            "-hls_flags".into(),
            "temp_file".into(),
            "-max_delay".into(),
            "5000000".into(),
        ]);

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec![
            "-hls_fmp4_init_filename".into(),
            init_seg.file_name().unwrap().display().to_string(),
        ]);
        args.append(&mut vec!["-hls_time".into(), target_gop.to_string()]);
        args.append(&mut vec![
            "-force_key_frames".into(),
            format!("expr:gte(t,n_forced*{})", target_gop),
        ]);

        args.append(&mut vec!["-hls_segment_type".into(), 1.to_string()]);
        args.append(&mut vec![
            "-loglevel".into(),
            "warning".into(),
            "-progress".into(),
            "pipe:1".into(),
        ]);
        args.append(&mut vec![
            "-hls_segment_filename".into(),
            segment_name.display().to_string(),
        ]);
        args.append(&mut vec![outdir.display().to_string()]);

        //println!("{:?}", args.join(" "));

        Ok(args)
    }

    fn content_type(&self) -> ContentType {
        ContentType::Video
    }
}
