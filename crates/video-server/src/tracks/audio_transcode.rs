use crate::media::MediaState;
use crate::media_info::TrackInfo;
use crate::stream_id::StreamId;
use crate::tracks::{ContentType, Track};
use std::collections::HashMap;
use std::io::Error;
use std::sync::Arc;
use tracing::info;

pub struct AudioTranscodeTrack {
    state: Arc<MediaState>,
    input_track: u32,
    output_track: u32,
    is_default: bool,
    args: HashMap<String, String>,
}

impl AudioTranscodeTrack {
    pub fn new(state: Arc<MediaState>, input_track: u32, output_track: u32, is_default: bool) -> Self {
        info!("stream @{} Add track {:?}:{}->{}", state.stream_id(), ContentType::Audio, input_track, output_track);
        Self {
            state,
            input_track,
            output_track,
            is_default,
            args: Default::default(),
        }
    }

    pub fn arg(mut self, key: &str, value: &str) -> Self {
        self.args.insert(key.into(), value.into());
        self
    }
}

impl Track for AudioTranscodeTrack {
    fn get_infos(&self) -> Result<&TrackInfo, Error> {
        self.state.info().get_track(self.input_track)
    }

    fn output_track(&self) -> u32 {
        self.output_track
    }

    fn stream_id(&self) -> &StreamId {
        self.state.stream_id()
    }

    fn is_default(&self) -> bool {
        self.is_default
    }

    fn args(&self) -> &HashMap<String, String> {
        &self.args
    }

    fn build_args(&self, start_num: u32) -> Result<Vec<String>, Error> {
        let target_gop = 5;
        let bitrate: Option<i32> = None;

        let init_seg = self.state.init_seg(start_num, self.output_track)?;
        let segment_name = self.state.chunk_path(self.output_track)?;
        let outdir = self.state.playlist_path(self.output_track)?;

        // NOTE: might need flags -fflages +genpts if seeking breaks.
        let mut args = vec![
            "-y".into(),
            "-ss".into(),
            (start_num * target_gop).to_string(),
            "-i".into(),
            self.state.source().to_str().unwrap().into(),
            "-copyts".into(),
            "-map".into(),
            format!("0:{}", self.input_track),
            "-c:0".into(),
            "aac".into(),
            "-loglevel".into(),
            "error".into()
        ];

        if self.get_infos()?.channels.unwrap_or(2) != 2 {
            args.append(&mut vec![
                "-af".into(),
                "pan=stereo|FL=0.5*FC+0.707*FL+0.707*BL+0.5*LFE|FR=0.5*FC+0.707*FR+0.707*BR+0.5*LFE".into(),
            ]);
        }

        let ab = bitrate.unwrap_or(120_000).to_string();
        args.push("-ab".into());
        args.push(ab);

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
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg.file_name().unwrap().display().to_string()]);

        args.append(&mut vec![
            "-hls_time".into(),
            target_gop.to_string(),
            "-force_key_frames".into(),
            format!("expr:gte(t,n_forced*{})", target_gop),
        ]);

        args.append(&mut vec!["-hls_segment_type".into(), "1".into()]);
        args.append(&mut vec![
            "-loglevel".into(),
            "info".into(),
            "-progress".into(),
            "pipe:1".into(),
        ]);
        args.append(&mut vec!["-hls_segment_filename".into(), segment_name.display().to_string()]);
        args.append(&mut vec![outdir.display().to_string()]);

        Ok(args)
    }

    fn content_type(&self) -> ContentType {
        ContentType::Audio
    }
}