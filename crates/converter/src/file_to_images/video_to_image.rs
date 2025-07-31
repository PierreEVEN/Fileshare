use crate::converter_error::ConverterError;
use crate::{Converter, ConverterTask, ToolPool};
use std::path::PathBuf;
use std::process::Stdio;
use std::str::FromStr;
use std::sync::Arc;

#[derive(Default)]
pub struct VideoToImage;

impl Converter for VideoToImage {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("ffmpeg")?;
        tool_pool.create_cmd("ffprobe")?;
        Ok(())
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        let mut mime_start = task.mimetype.split("/");
        Ok(mime_start.next().ok_or(ConverterError::InvalidInput(format!("invalid mimetype : {}", task.mimetype)))? == "video")
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "image/webp".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
            let get_duration_cmd = tool_pool.create_cmd("ffprobe")?
                .arg("-v")
                .arg("error")
                .arg("-show_entries")
                .arg("format=duration")
                .arg("-of")
                .arg("default=noprint_wrappers=1:nokey=1")
                .arg(&task.input)
                .stderr(Stdio::inherit())
                .output()?;

            let duration = f32::from_str(String::from_utf8(get_duration_cmd.stdout)?.as_str()).unwrap_or(0f32);

            tool_pool.create_cmd("ffmpeg")?
                .arg("-v")
                .arg("error")
                .arg("-ss")
                .arg((duration / 2f32).to_string())
                .arg("-i")
                .arg(&task.input)
                .args(if let Some(size) = task.output_max_size {vec!["-vf".to_string(), format!("scale={}:{}:force_original_aspect_ratio=decrease", size, size)]} else {vec![]})
                .arg("-vframes")
                .arg("1")
                .arg("-f")
                .arg("webp")
                .arg(&task.output)
                .stderr(Stdio::inherit())
                .spawn()?
                .wait_with_output()?;
            Ok(())
        } else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}