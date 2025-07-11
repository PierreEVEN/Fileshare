use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tracing::{error};
use crate::error::StreamingError;

pub struct FfmpegProcess {
    process: RwLock<Option<Child>>,
    progress_state: Arc<RwLock<HashMap<String, String>>>,
    stdout_parser: JoinHandle<()>,
    stderr_parser: JoinHandle<()>
}

impl FfmpegProcess {
    pub fn spawn(args: &Vec<String>, process_identifier: String) -> Result<Self, StreamingError> {
        let mut process = Command::new("ffmpeg")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .args(args.as_slice())
            .spawn()?;
        let stdout = process.stdout.take().unwrap();
        let stderr = process.stderr.take().unwrap();
        let progress_state = Arc::new(RwLock::new(HashMap::<String, String>::new()));

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
        })
    }

    pub async fn join(&self) -> Result<(), StreamingError> {
        let mut process = self.process.write().await;
        if let Some(mut process) = process.take() {
            process.wait().await?;
        }
        Ok(())
    }
}