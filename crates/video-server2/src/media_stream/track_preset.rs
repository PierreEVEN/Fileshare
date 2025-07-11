use std::path;
use crate::error::StreamingError;
use crate::media_stream::preset_description::PresetDescription;
use crate::media_stream::stream_track::TrackDefinition;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use tracing::info;
use utils::config::VideoServerConfig;

pub struct TrackPreset {
    global_config: Arc<VideoServerConfig>,
    description: PresetDescription,
    parent_track: Arc<TrackDefinition>,
    force_transcoding: bool,
}

impl TrackPreset {
    pub fn new(global_config: Arc<VideoServerConfig>, description: PresetDescription, parent_track: Arc<TrackDefinition>) -> Self {
        Self {
            global_config,
            description,
            parent_track,
        }
    }
    
    pub fn build_args(&self, start_num: u32, preset_ref: &PresetRef) -> Result<Vec<String>, StreamingError> {
        let preset = self.get_preset(preset_ref)?;

        let mut args = vec![
            "-y".into(),
            "-ss".into(), (start_num * self.segment_duration).to_string(),
            "-i".into(), self.owning_stream.source().to_str().unwrap().into(),
            "-map".into(), format!("0:{}", self.input_track),
        ];

        // Directly copy stream everytime it's possible to save CPU usage
        if self.should_transcode(preset)? {
            info!("Stream {}:{} is using full video transcoding", self.owning_stream.stream_id(), self.output_track);

            let track_info = self.track_info()?;

            match track_info.codec_type.as_str() {
                "audio" => {
                    args.append(&mut vec!["-c:0".into(), "aac".into(), "-ab".into(), preset.get_bitrate(track_info).to_string()]);
                },
                "video" => {
                    args.append(&mut vec!["-vf".into(), format!("scale={}:{}", preset.get_height(track_info), preset.get_width(track_info))]);
                    args.append(&mut vec!["-b:v".into(), preset.get_bitrate(track_info).to_string()]);
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

        let cache_path = &self.owning_stream.global_config()?.cache_path;

        let init_seg = if cfg!(target_os = "windows") { path::absolute(preset_ref.init_path(cache_path, start_num))? }
        else { PathBuf::from(preset_ref.init_path(cache_path, start_num).file_name().unwrap()) };

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg.display().to_string()]);
        args.append(&mut vec!["-hls_time".into(), self.segment_duration.to_string()]);
        args.append(&mut vec!["-force_key_frames".into(), format!("expr:gte(t,n_forced*{})", self.segment_duration)]);

        args.append(&mut vec!["-hls_segment_type".into(), "1".into()]);
        args.append(&mut vec!["-loglevel".into(), "warning".into(), "-progress".into(), "pipe:1".into()]);
        args.append(&mut vec!["-hls_segment_filename".into(), path::absolute(preset_ref.chunk_path(cache_path, "%d".to_string()))?.display().to_string()]);
        args.append(&mut vec![path::absolute(preset_ref.playlist_path(cache_path))?.display().to_string()]);
        Ok(args)
    }

    pub fn should_transcode(&self) -> Result<bool, StreamingError> {
        if self.force_transcoding { return Ok(true); }
        let media_info = self.owning_stream.media_info();
        let track_info = media_info.get_track(self.input_track)?;

        match &track_info.codec_name {
            Some(codec) => if !is_supported_html5_codec(codec.as_str()) { return Ok(true) }
            None => return Ok(true)
        }

        if let Some(max_height) = preset.max_height {
            if let Some(track_height) = track_info.height {
                if (max_height as i64) < track_height { return Ok(true) }
            } else {
                return Ok(true)
            }
        }

        if preset.max_bitrate.is_some() {
            return Ok(true)
        }

        if let Some(max_fps) = preset.max_frame_rate {
            if let Ok(track_fps) = track_info.get_framerate() {
                if max_fps < track_fps { return Ok(true) }
            } else {
                return Ok(true)
            }
        }

        Ok(false)
    }

    pub fn description(&self) -> &PresetDescription {
        &self.description
    }

    pub async fn get_init(&self, _num: u32) -> Result<PathBuf, StreamingError> {
        sleep(Duration::from_secs(10)).await;
        todo!()
    }

    pub async fn get_chunk(&self, _num: u32) -> Result<PathBuf, StreamingError> {
        sleep(Duration::from_secs(10)).await;
        todo!()
    }
}