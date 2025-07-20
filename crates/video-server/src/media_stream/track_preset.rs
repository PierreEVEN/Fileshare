use std::{fs, path};
use crate::error::{ErrorKind, StreamingError};
use crate::media_stream::preset_description::PresetDescription;
use crate::media_stream::stream_track::TrackDefinition;
use std::path::PathBuf;
use std::sync::{Arc};
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tokio::time::sleep;
use tracing::{info, warn};
use utils::config::VideoServerConfig;
use crate::media_info::media_info::{CodecType, Framerate};
use crate::media_info::stream_reference::StreamReference;
use crate::media_stream::ffmpeg_process::FfmpegProcess;
use crate::media_stream::StreamingStats;

pub struct TrackPreset {
    global_config: Arc<VideoServerConfig>,
    stats: Arc<StreamingStats>,
    description: PresetDescription,
    parent_track: Arc<TrackDefinition>,
    force_transcoding: bool,
    stream_reference: StreamReference,
    output_track_index: u32,
    gen_proc: RwLock<Option<Arc<FfmpegProcess>>>,
}

#[derive(Debug)]
pub enum TranscodingMode  {
    Raw,
    Forced,
    ForceHeight(u32),
    ForceBitrate(u32),
    ChangePixelFormat{old: String, new: String},
    ForceFramerate(Framerate),
    CodecNotSupported(String),
}

impl TrackPreset {
    pub fn new(global_config: Arc<VideoServerConfig>, stats: Arc<StreamingStats>, output_track_index: u32, stream_reference: StreamReference, description: PresetDescription, parent_track: Arc<TrackDefinition>) -> Result<Self, StreamingError> {
        fs::create_dir_all(path::absolute(global_config.cache_path.join(PathBuf::from(&stream_reference.path().file_name().unwrap()).join(output_track_index.to_string()).join(description.to_string())))?)?;
        Ok(Self {
            global_config,
            stats,
            description,
            parent_track,
            force_transcoding: false,
            stream_reference,
            output_track_index,
            gen_proc: Default::default(),
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
        match self.should_transcode()? {
            TranscodingMode::Raw => {
                args.append(&mut vec!["-c:0".into(), "copy".into()]);
            }
            _ => {
                match &self.parent_track.codec_type {
                    CodecType::Audio => {
                        args.append(&mut vec!["-c:0".into(), "aac".into(), "-ab".into(), self.description.bitrate(&self.parent_track).to_string()]);
                    }
                    CodecType::Video => {
                        let mut vf_args = String::new();
                        vf_args += format!("scale={}:{}", self.description.height(&self.parent_track), self.description.width(&self.parent_track)).as_str();
                        if if let Some(pixel_format) = &self.parent_track.pixel_format {
                            pixel_format.as_str() != "yuv420p"
                        } else { true } {
                            vf_args += " format=yuv420p";
                        }
                        args.append(&mut vec!["-vf".into(), vf_args.trim().replace(" ", ",")]);

                        args.append(&mut vec!["-b:v".into(), self.description.bitrate(&self.parent_track).to_string()]);
                        args.append(&mut vec!["-c:0".into(), "h264".into(), "-preset".into(), "veryfast".into()]);
                    }
                    c => { return Err(StreamingError::new(ErrorKind::UnknownCodec(c.to_string()))) }
                }
            }
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

        let init_seg = if cfg!(target_os = "windows") { path::absolute(self.init_path(start_num))? } else { PathBuf::from(self.init_path(start_num).file_name().unwrap()) };

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

    pub async fn tick(&self) -> Result<(), StreamingError> {
        let finished = if let Some(proc_val) = &*self.gen_proc.read().await {
            proc_val.is_finished()
        } else {
            false
        };
        if finished {
            *self.gen_proc.write().await = None;
        }
        Ok(())
    }

    pub fn parent_track(&self) -> &Arc<TrackDefinition> {
        &self.parent_track
    }

    pub fn should_transcode(&self) -> Result<TranscodingMode, StreamingError> {
        if self.force_transcoding { return Ok(TranscodingMode::Forced); }

        match &self.parent_track.codec {
            Some(codec) => if !Self::is_supported_html5_codec(codec.as_str()) { return Ok(TranscodingMode::CodecNotSupported(codec.clone())) }
            None => return Ok(TranscodingMode::CodecNotSupported("''".to_string()))
        }

        if let Some(max_height) = self.description.max_height {
            if max_height < self.parent_track.input_height { return Ok(TranscodingMode::ForceHeight(max_height)); }
        }

        if let Some(max_bitrate) = self.description.max_bitrate {
            return Ok(TranscodingMode::ForceBitrate(max_bitrate));
        }

        if let CodecType::Video = self.parent_track.codec_type {
            if let Some(pixel_format) = &self.parent_track.pixel_format {
                if pixel_format.as_str() != "yuv420p" {
                    return Ok(TranscodingMode::ChangePixelFormat {old:pixel_format.clone(), new: "yuv420p".to_string() });
                }
            }
        }

        if let Some(max_fps) = self.description.max_frame_rate {
            if max_fps < self.parent_track.input_framerate { return Ok(TranscodingMode::ForceFramerate(max_fps)); }
        }

        Ok(TranscodingMode::Raw)
    }

    pub fn description(&self) -> &PresetDescription {
        &self.description
    }

    pub fn is_init_valid(&self, num: u32) -> Result<bool, StreamingError> {
        let path = self.init_path(num);
        Ok(if !path.exists() {
            false
        } else {
            path.metadata()?.len() != 0
        })
    }

    pub async fn get_init(&self, num: u32) -> Result<PathBuf, StreamingError> {
        let path = self.init_path(num);
        if self.is_init_valid(num)? {
            return Ok(path);
        }

        {
        let proc = &mut *self.gen_proc.write().await;
        if proc.is_none() {
            info!("Generate Dash segments for stream {} -> {}:{}", self.stream_reference.id(), self.parent_track.codec_type, self.output_track_index);
            match self.should_transcode()? {
                TranscodingMode::Raw => {}
                mode => {
                    warn!("Stream {} -> {}:{} requires video transcoding : {mode:?}", self.stream_reference.id(), self.parent_track.codec_type, self.output_track_index)
                }
            }
            *proc = Some(Arc::new(FfmpegProcess::spawn(num, self.global_config.clone(), self.stats.clone(), &self.build_args(0, None)?, format!("{} -> {}:{}", self.stream_reference.id(), self.parent_track.codec_type, self.output_track_index))?));
        }
            }

        let start = SystemTime::now();
        while !self.is_init_valid(num)? {
            sleep(Duration::from_millis(self.global_config.tick_interval_ms)).await;
            if SystemTime::now().duration_since(start)? > self.global_config.max_request_timout {
                break;
            }
        }
        if self.is_init_valid(num)? {
            Ok(path)
        } else {
            Err(StreamingError::new(ErrorKind::InitNotFound { track: self.output_track_index, num }))
        }
    }

    pub async fn get_chunk(&self, num: u32) -> Result<PathBuf, StreamingError> {
        let path = self.chunk_path(num.to_string());
        if path.exists() {
            return Ok(path);
        }

        let start = SystemTime::now();

        while !path.exists() {
            sleep(Duration::from_millis(self.global_config.tick_interval_ms)).await;
            if SystemTime::now().duration_since(start)? > self.global_config.max_request_timout {
                break;
            }
        }

        if path.exists() {
            Ok(path)
        } else {
            Err(StreamingError::new(ErrorKind::ChunkNotFound { track: self.output_track_index, num }))
        }
    }
}