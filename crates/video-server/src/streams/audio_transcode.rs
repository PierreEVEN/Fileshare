use crate::media_info::StreamInfo;
use crate::streams::{ContentType, Stream};
use std::collections::HashMap;
use std::io::Error;
use std::path::PathBuf;

pub struct AudioTranscodeStream {
    source: PathBuf,
    media_id: u64,
    info: StreamInfo,
    stream_index: u32,
    is_default: bool,
    args: HashMap<String, String>,
}

impl AudioTranscodeStream {
    pub fn new(source: PathBuf, media_id: u64, info: StreamInfo, stream_index: u32, is_default: bool) -> Self {
        Self {
            source,
            media_id,
            info,
            stream_index,
            is_default,
            args: Default::default(),
        }
    }

    pub fn arg(mut self, key: &str, value: &str) -> Self {
        self.args.insert(key.into(), value.into());
        self
    }
}

impl Stream for AudioTranscodeStream {
    fn get_infos(&self) -> &StreamInfo {
        &self.info
    }

    fn stream_index(&self) -> u32 {
        self.stream_index
    }

    fn media_id(&self) -> u64 {
        self.media_id
    }

    fn is_default(&self) -> bool {
        self.is_default
    }

    fn args(&self) -> &HashMap<String, String> {
        &self.args
    }

    fn build_args(&self, start_num: u32) -> Result<Vec<String>, Error> {
        let target_gop = 5;
        let output_dir = "./data/tmp_video";
        let input_stream = 0;
        let bitrate: Option<i32> = None;

        let stream = format!("0:{}", input_stream);
        let init_seg = format!("{}_init.mp4", &start_num);
        let segment_name = format!("{output_dir}/%d.m4s");
        let outdir = format!("{output_dir}/playlist.m3u8");

        // NOTE: might need flags -fflages +genpts if seeking breaks.
        let mut args = vec![
            "-y".into(),
            "-ss".into(),
            (start_num * target_gop).to_string(),
            "-i".into(),
            self.source.to_str().unwrap().into(),
            "-copyts".into(),
            "-map".into(),
            stream,
            "-c:0".into(),
            "aac".into(),
        ];

        if self.info.channels.unwrap_or(2) != 2 {
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
            "-vsync".into(),
            "-1".into(),
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
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg]);

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
        args.append(&mut vec!["-hls_segment_filename".into(), segment_name]);
        args.append(&mut vec![outdir]);

        Ok(args)
    }

    fn content_type(&self) -> ContentType {
        ContentType::Audio
    }
}