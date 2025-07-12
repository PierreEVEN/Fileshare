use std::{fs, path};
use crate::error::{ErrorKind, StreamingError};
use crate::media_stream::preset_description::PresetDescription;
use crate::media_stream::stream_track::TrackDefinition;
use std::path::PathBuf;
use std::sync::{Arc};
use std::time::{SystemTime};
use utils::config::VideoServerConfig;
use crate::media_info::media_info::CodecType;
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::ffmpeg_process::FfmpegProcess;

pub struct TrackPreset {
    global_config: Arc<VideoServerConfig>,
    description: PresetDescription,
    parent_track: Arc<TrackDefinition>,
    force_transcoding: bool,
    stream_reference: StreamReference,
    output_track_index: u32,
}

impl TrackPreset {
    pub fn new(global_config: Arc<VideoServerConfig>, output_track_index: u32, stream_reference: StreamReference, description: PresetDescription, parent_track: Arc<TrackDefinition>) -> Result<Self, StreamingError> {
        fs::create_dir_all(path::absolute(global_config.cache_path.join(PathBuf::from(&stream_reference.path().file_name().unwrap()).join(output_track_index.to_string()).join(description.to_string())))?)?;
        Ok(Self {
            global_config,
            description,
            parent_track,
            force_transcoding: false,
            stream_reference,
            output_track_index,
        })
    }

    pub fn build_args(&self, start_num: u32, num_chunk: Option<u32>) -> Result<Vec<String>, StreamingError> {
        let mut args = vec![
            "-y".into(),
            "-ss".into(), (start_num * self.global_config.segment_duration_sec).to_string(),
            "-i".into(), self.stream_reference.path().to_str().unwrap().into(),
            "-map".into(), format!("0:{}", self.parent_track.index),
        ];

        if let Some(num_chunk) = num_chunk {
            args.append(&mut vec!["-t".into(), ((start_num + num_chunk) * self.global_config.segment_duration_sec).to_string()])
        }

        // Directly copy stream everytime it's possible to save CPU usage
        if self.should_transcode()? {
            match &self.parent_track.codec_type {
                CodecType::Audio => {
                    args.append(&mut vec!["-c:0".into(), "aac".into(), "-ab".into(), self.description.bitrate(&self.parent_track).to_string()]);
                },
                CodecType::Video => {
                    args.append(&mut vec!["-vf".into(), format!("scale={}:{}", self.description.height(&self.parent_track), self.description.width(&self.parent_track))]);
                    args.append(&mut vec!["-b:v".into(), self.description.bitrate(&self.parent_track).to_string()]);
                    args.append(&mut vec!["-c:0".into(), "h264".into(), "-preset".into(), "veryfast".into()]);
                }
                c => { return Err(StreamingError::new(ErrorKind::UnknownCodec(c.to_string()))) }
            }
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

        let init_seg = if cfg!(target_os = "windows") { path::absolute(self.init_path(start_num))? }
        else { PathBuf::from(self.init_path(start_num).file_name().unwrap()) };

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg.display().to_string()]);
        args.append(&mut vec!["-hls_time".into(), self.global_config.segment_duration_sec.to_string()]);
        args.append(&mut vec!["-force_key_frames".into(), format!("expr:gte(t,n_forced*{})", self.global_config.segment_duration_sec)]);

        args.append(&mut vec!["-hls_segment_type".into(), "1".into()]);
        args.append(&mut vec!["-loglevel".into(), "warning".into(), "-progress".into(), "pipe:1".into()]);
        args.append(&mut vec!["-hls_segment_filename".into(), path::absolute(self.chunk_path("%d".to_string()))?.display().to_string()]);
        args.append(&mut vec![path::absolute(self.playlist_path())?.display().to_string()]);
        Ok(args)
    }

    pub fn init_path(&self, start_num: u32) -> PathBuf {
        self.global_config.cache_path.join(PathBuf::from(&self.stream_reference.path().file_name().unwrap()).join(self.output_track_index.to_string()).join(self.description.to_string()).join(format!("{start_num}_init.mp4")))
    }
    pub fn chunk_path(&self, chunk: String) -> PathBuf {
        self.global_config.cache_path.join(PathBuf::from(&self.stream_reference.path().file_name().unwrap()).join(self.output_track_index.to_string()).join(self.description.to_string()).join(format!("{chunk}.m4s")))
    }
    pub fn playlist_path(&self) -> PathBuf {
        self.global_config.cache_path.join(PathBuf::from(&self.stream_reference.path().file_name().unwrap()).join(self.output_track_index.to_string()).join(self.description.to_string()).join("playlist.m3u8"))
    }

    fn is_supported_html5_codec(codec: &str) -> bool {
        match codec {
            "h264" | "libopenh264" | "vp8" | "vp9" | "theora" | "libtheora" => true,
            "aac" | "libmp3lame" | "mp3" | "opus" | "libopus" | "vorbis" | "libvorbis" => true,
            &_ => false,
        }
    }

    fn should_transcode(&self) -> Result<bool, StreamingError> {
        if self.force_transcoding { return Ok(true); }

        match &self.parent_track.codec {
            Some(codec) => if !Self::is_supported_html5_codec(codec.as_str()) { return Ok(true) }
            None => return Ok(true)
        }

        if let Some(max_height) = self.description.max_height {
            if max_height < self.parent_track.input_height { return Ok(true) }
        }

        if self.description.max_bitrate.is_some() {
            return Ok(true)
        }

        if let Some(max_fps) = self.description.max_frame_rate {
            if max_fps < self.parent_track.input_framerate { return Ok(true) }
        }

        Ok(false)
    }

    pub fn description(&self) -> &PresetDescription {
        &self.description
    }

    async fn generate_chunks_for(&self, num: u32) -> Result<Arc<FfmpegProcess>, StreamingError> {
        let args = &self.build_args(num, Some(1))?;
        let process = Arc::new(FfmpegProcess::spawn(num, self.global_config.clone(), args, "Test".to_string())?);
        Ok(process)
    }

    pub async fn get_init(&self, num: u32) -> Result<PathBuf, StreamingError> {

        let path = self.init_path(num);
        if path.exists() {
            return Ok(path);
        }

        let process = self.generate_chunks_for(num).await?;
        process.join().await?;

        if path.exists() {
            Ok(path)
        } else {
            Err(StreamingError::new(ErrorKind::InitNotFound {track: self.output_track_index, num}))
        }
    }

    pub async fn get_chunk(&self, num: u32) -> Result<PathBuf, StreamingError> {
        let path = self.chunk_path(num.to_string());
        if path.exists() {
            return Ok(path);
        }

        let process = self.generate_chunks_for(num).await?;
        process.join().await?;

        if path.exists() {
            Ok(path)
        } else {
            Err(StreamingError::new(ErrorKind::InitNotFound {track: self.output_track_index, num}))
        }
    }
}