mod media_info;

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::{fs, io};

pub struct Stream {
    id: i64,
    source: PathBuf,
}

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

impl Stream {
    pub fn new(source: PathBuf) -> Self {
        Self { id: 0, source }
    }

    pub fn id(&self) -> i64 {
        self.id
    }

    pub fn run_video(&self) -> Result<(), io::Error> {
        let args = self.video_args_transmux()?;
        fs::create_dir_all("./data/tmp_video/")?;

        let mut process = Command::new("ffmpeg")
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .stdin(Stdio::null())
            .args(args.as_slice())
            .spawn()?;

        process.wait()?;

        Ok(())
    }

    pub fn video_args_transcode(&self) -> Result<Vec<String>, io::Error> {
        let start_num = 0;
        let target_gop = 5;
        let output_dir = "./data/tmp_video";
        let input_stream = 0;
        let height: Option<i32> = None;
        let width: Option<i32> = None;
        let bitrate: Option<i32> = None;

        let start_num = start_num;
        let stream = format!("0:{}", input_stream);
        let init_seg = format!("{}_init.mp4", &start_num);
        let segment_name = format!("{output_dir}/%d.m4s");
        let outdir = format!("{output_dir}/playlist.m3u8");

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
            "libx264".into(),
            "-preset".into(),
            "veryfast".into(),
        ];

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
            "-vsync".into(),
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
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg]);
        args.append(&mut vec!["-hls_time".into(), target_gop.to_string()]);
        args.append(&mut vec![
            "-force_key_frames".into(),
            format!("expr:gte(t,n_forced*{})", target_gop),
        ]);

        args.append(&mut vec!["-hls_segment_type".into(), 1.to_string()]);
        args.append(&mut vec![
            "-loglevel".into(),
            "info".into(),
            "-progress".into(),
            "pipe:1".into(),
        ]);
        args.append(&mut vec!["-hls_segment_filename".into(), segment_name]);
        args.push(outdir);

        Ok(args)
    }

    pub fn video_args_transmux(&self) -> Result<Vec<String>, io::Error> {
        let start_num = 0;
        let target_gop = 5;
        let output_dir = "./data/tmp_video";
        let input_stream = 0;

        let start_num = start_num;
        let stream = format!("0:{}", input_stream);
        let init_seg = format!("{}_init.mp4", &start_num);
        let segment_name = format!("{output_dir}/%d.m4s");
        let outdir = format!("{output_dir}/playlist.m3u8");

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
            "copy".into(),
        ];

        args.append(&mut vec![
            "-start_at_zero".into(),
            "-vsync".into(),
            "passthrough".into(),
            "-avoid_negative_ts".into(),
            "disabled".into(),
            "-max_muxing_queue_size".into(),
            "2048".into(),
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

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg]);

        args.append(&mut vec!["-hls_time".into(), target_gop.to_string()]);

        args.append(&mut get_discont_flags(start_num));

        args.append(&mut vec![
            "-force_key_frames".into(),
            format!("expr:gte(t,n_forced*{})", target_gop),
        ]);

        args.append(&mut vec!["-hls_segment_type".into(), 1.to_string()]);
        args.append(&mut vec![
            "-loglevel".into(),
            "info".into(),
            "-progress".into(),
            "pipe:1".into(),
        ]);
        args.append(&mut vec!["-hls_segment_filename".into(), segment_name]);
        args.push(outdir);

        Ok(args)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let source = PathBuf::from("/home/pierre/Téléchargements/big_buck_bunny_1080p_h264.mov");

        //let infos = media_info::MediaInfo::new(&source);
        //println!("{:?}", infos);

        let stream = Stream::new(source);
        stream.run_video().unwrap();
    }
}
