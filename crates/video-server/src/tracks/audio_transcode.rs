use std::path::PathBuf;
use crate::tracks::{ContentType, Track, TrackState};
use tracing::info;
use crate::error::StreamingError;
use crate::tracks::presets::track_preset::TrackPreset;

pub struct AudioTranscodeTrack {
    config: TrackState,
}

impl AudioTranscodeTrack {
    pub fn new(config: TrackState) -> Self {
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

impl Track for AudioTranscodeTrack {
    fn state(&self) -> &TrackState {
        &self.config
    }

    fn build_args(&self, start_num: u32, preset: TrackPreset) -> Result<Vec<String>, StreamingError> {
        let target_gop = 5;
        let bitrate: Option<i32> = None;

        let init_seg = if cfg!(target_os = "windows") {
            self.state().media_state.init_seg(start_num, self.state().output_track)?
        } else {
            PathBuf::from(self.state().media_state.init_seg(start_num, self.state().output_track)?.file_name().unwrap())
        };

        let segment_name = self.state().media_state.chunk_path(self.state().output_track)?;

        // NOTE: might need flags -fflages +genpts if seeking breaks.
        let mut args = vec![
            "-y".into(),
            "-ss".into(),
            (start_num * target_gop).to_string(),
            "-i".into(),
            self.state().media_state.source().to_str().unwrap().into(),
            "-copyts".into(),
            "-map".into(),
            format!("0:{}", self.state().input_track),
            "-loglevel".into(),
            "24".into(),
        ];

        // Copy existing stream if it is html5-compatible
        let should_transcode = if let Some(codec) = &self.state().track_info()?.codec_name {
            match codec.as_str() {
                "aac" | "libmp3lame" | "mp3" | "opus" | "libopus" | "vorbis" | "libvorbis" => false,
                &_ => true,
            }
        } else {
            true
        } || self.state().track_info()?.channels.unwrap_or(2) > 2
            || self.config.force_transcoding;

        if should_transcode {
            info!("Stream {}:{} is using full audio transcoding", self.state().media_state.stream_id(), self.state().output_track);
            let ab = bitrate.unwrap_or(120_000).to_string();
            args.append(&mut vec!["-c:0".into(), "aac".into(), "-ab".into(), ab]);

            if self.state().track_info()?.channels.unwrap_or(2) > 2 {
                args.append(&mut vec![
                    "-af".into(),
                    "pan=stereo|FL=0.5*FC+0.707*FL+0.707*BL+0.5*LFE|FR=0.5*FC+0.707*FR+0.707*BR+0.5*LFE".into(),
                ]);
            }
        } else {
            args.append(&mut vec!["-c:0".into(), "copy".into()]);
        }

        args.append(&mut vec![
            "-start_at_zero".into(),
            "-avoid_negative_ts".into(),
            "make_non_negative".into(),
        ]);

        args.append(&mut vec![
            "-f".into(),
            "hls".into(),
            "-start_number".into(),
            start_num.to_string(),
        ]);

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

        // these args are needed if we start a new stream in the middle of a old one, such as when
        // seeking. These args will reset the base decode ts to equal the earliest presentation
        // timestamp.
        if start_num > 0 {
            args.append(&mut vec![
                "-hls_segment_options".into(),
                "movflags=frag_custom+dash+delay_moov+frag_discont".into(),
            ]);
        } else {
            args.append(&mut vec![
                "-hls_segment_options".into(),
                "movflags=frag_custom+dash+delay_moov".into(),
            ]);
        }

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec![
            "-hls_fmp4_init_filename".into(),
            init_seg.display().to_string(),
        ]);

        args.append(&mut vec![
            "-hls_time".into(),
            target_gop.to_string(),
            "-force_key_frames".into(),
            format!("expr:gte(t,n_forced*{})", target_gop),
        ]);

        args.append(&mut vec!["-hls_segment_type".into(), "1".into()]);
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

        args.push(self.state().media_state.playlist_path(self.state().output_track)?.display().to_string());

        Ok(args)
    }

    fn content_type(&self) -> ContentType {
        ContentType::Audio
    }
}
