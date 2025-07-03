use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::{Child, Command};
use std::time::{Duration, SystemTime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::RwLock;
use tracing::{error, info};
use crate::error::StreamingError;
use crate::tracks::Track;

pub struct BuildingProcess {
    start_num: u32,
    limit: Option<u32>,
    start_time: SystemTime,
    pub usage_count: u32,
    process: Child,
    stdout_parser: tokio::task::JoinHandle<()>,
    stderr_parser: tokio::task::JoinHandle<()>,
    progress_state: Arc<RwLock<HashMap<String, String>>>
}

impl BuildingProcess {
    pub async fn new(start_num: u32, limit: Option<u32>, track: &dyn Track) -> Result<Self, StreamingError> {
        let content_type = track.content_type();
        let track_index = track.state().output_track;

        let mut process = Command::new("ffmpeg")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .args(track.build_args(start_num)?.as_slice())
            .spawn()?;
        let stdout = process.stdout.take().unwrap();
        let stderr = process.stderr.take().unwrap();
        let progress_state = Arc::new(RwLock::new(HashMap::<String, String>::new()));

        let state = track.state().media_state.clone();
        let stdout_progress_state = progress_state.clone();
        let stdout_parser = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut input = String::new();
            'main_loop: while reader.read_line(&mut input).await.expect("Failed to read ffmpeg output line") != 0 {
                let mut result = stdout_progress_state.write().await;
                if let Some((key, value)) = input.split_once('=') {
                    result.insert(key.trim().to_string(), value.trim().to_string());
                    if key == "progress" && value == "end" {
                        break 'main_loop;
                    }
                }
                input.clear();
            }
            info!("Finished processing for {track_index}:{content_type:?} track");
        });
        let stderr_parser = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut input = String::new();
            while reader.read_line(&mut input).await.expect("Failed to read ffmpeg output error line") != 0 {
                error!("Stream {}:{} : {}", state.stream_id(), track_index, input.trim());
                input.clear();
            }
        });


        Ok(Self {
            start_num,
            limit,
            start_time: SystemTime::now(),
            usage_count: 1,
            process,
            stdout_parser,
            stderr_parser,
            progress_state,
        })
    }

    pub fn start_num(&self) -> u32 {self.start_num}
    pub fn set_limit(&mut self, new_limit: u32) {self.limit = Some(new_limit)}

    pub fn chunk_eta(&self, chunk: u32) -> Duration {
        if chunk < self.start_num {
            return Duration::MAX;
        }
        if let Some(limit) = self.limit {
            if limit < chunk {
                return Duration::MAX;
            }
        }
        todo!()
    }
    
    pub async fn kill(&mut self) -> Result<(), StreamingError> {
        self.stdout_parser.abort();
        self.stderr_parser.abort();
        Ok(self.process.kill().await?)
    }
}
