use std::collections::{HashMap};
use std::process::Stdio;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tracing::{error};
use utils::config::VideoServerConfig;
use crate::error::StreamingError;
use crate::media_stream::stream_track::TrackDefinition;

#[derive(Default)]
pub struct ProgressState {
    progress: u32,
    chunks_per_second: f64,
    params: HashMap<String, String>
}

pub struct FfmpegProcess {
    process: RwLock<Option<Child>>,
    stdout_parser: JoinHandle<()>,
    stderr_parser: JoinHandle<()>,
    progress_state: Arc<RwLock<ProgressState>>,
    chunk_limit: Option<u32>,
    start_chunk: u32
}

pub enum ChunkEta {
    NotInRange,
    NotStarted,
    Eta(Duration)
}

impl FfmpegProcess {
    pub fn spawn(start_chunk: u32, global_config: Arc<VideoServerConfig>, args: &Vec<String>, process_identifier: String) -> Result<Self, StreamingError> {
        let mut process = Command::new("ffmpeg")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .args(args.as_slice())
            .spawn()?;
        let stdout = process.stdout.take().unwrap();
        let stderr = process.stderr.take().unwrap();
        let progress_state = Arc::new(RwLock::new(ProgressState::default()));

        let stdout_progress_state = progress_state.clone();
        let stdout_parser = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut input = String::new();
            'main_loop: while reader.read_line(&mut input).await.expect("Failed to read ffmpeg output line") != 0 {
                let mut result = stdout_progress_state.write().await;
                if let Some((key, value)) = input.split_once('=') {
                    let value = value.trim();
                    result.params.insert(key.trim().to_string(), value.to_string());
                    match key {
                        "out_time_us" => {
                            match u64::from_str(value) {
                                Ok(out_time_us) => {
                                    result.progress = ((out_time_us as f64) / 1_000_000f64 / global_config.segment_duration_sec as f64) as u32;
                                }
                                Err(err) => {
                                    error!("Failed to parse out_time_us = '{}' : {}", value, err);
                                }
                            }
                        },
                        "speed" => {
                            if value.ends_with("x") {
                                let value_sub = &value[0..value.len() - 1];
                                match f64::from_str(value_sub) {
                                    Ok(speed) => {
                                        let chunk_per_sec = if speed == 0f64 {
                                            0f64
                                        } else {
                                            let segment_gen_duration = global_config.segment_duration_sec as f64 / speed ;
                                            1f64 / segment_gen_duration
                                        };
                                        result.chunks_per_second = chunk_per_sec;
                                    }
                                    Err(err) => {
                                        error!("Failed to parse speed = '{}' : {}", value, err);
                                    }
                                }
                            } else {
                                error!("Unknown speed value : '{}'", value)
                            }
                        }
                        _ => {}
                    }
                    if key == "progress" && value == "end" {
                        break 'main_loop;
                    }
                }
                input.clear();
            }
        });
        let stderr_parser = tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut input = String::new();
            while reader.read_line(&mut input).await.expect("Failed to read ffmpeg output error line") != 0 {
                error!("Stream {} : {}", process_identifier, input.trim());
                input.clear();
            }
        });

        Ok(Self {
            process: RwLock::new(Some(process)),
            progress_state,
            stdout_parser,
            stderr_parser,
            chunk_limit: None,
            start_chunk,
        })
    }

    pub async fn chunk_eta(&self, chunk: u32) -> ChunkEta {
        let progress = self.progress_state.read().await;
        if chunk < self.start_chunk {
            ChunkEta::NotInRange
        } else if chunk < progress.progress {
            ChunkEta::Eta(Duration::default())
        } else {
            if progress.chunks_per_second == 0f64 {
                ChunkEta::NotStarted
            } else {
                let delta = chunk - progress.progress;
                ChunkEta::Eta(Duration::from_secs_f64(delta as f64 / progress.chunks_per_second))
            }
        }
    }

    pub async fn chunk_delta_to_creation(&self, chunk: u32) -> i32 {
        let progress = self.progress_state.read().await;
        if chunk < self.start_chunk {
            self.start_chunk as i32 - chunk as i32
        } else if chunk < progress.progress {
            0
        } else {
            if progress.chunks_per_second == 0f64 {
                0
            } else {
                chunk as i32 - progress.progress as i32
            }
        }
    }

    pub async fn join(&self) -> Result<(), StreamingError> {
        let mut process = self.process.write().await;
        if let Some(mut process) = process.take() {
            process.wait().await?;
        }
        Ok(())
    }
}