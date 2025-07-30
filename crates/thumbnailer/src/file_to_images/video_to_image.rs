use std::process::{Command, Stdio};
use std::str::FromStr;
use anyhow::{anyhow, Error};
use crate::file_to_images::Processor;
use crate::ThumbnailerTask;

pub struct VideoToImage;

impl Processor for VideoToImage {
    fn name(&self) -> String {
        "video to image".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        match Command::new("ffmpeg").arg("--version").output() {
            Ok(_) => {Ok(())}
            Err(err) => {
                Err(anyhow!("Requires ffmpeg : {err}"))
            }
        }
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        let mut mime_start = task.mimetype.split("/");
        match mime_start.next().ok_or(Error::msg("Invalid mimetype"))? {
            "video" => {
                let get_duration_cmd = match Command::new("ffprobe")
                    .arg("-v")
                    .arg("error")
                    .arg("-show_entries")
                    .arg("format=duration")
                    .arg("-of")
                    .arg("default=noprint_wrappers=1:nokey=1")
                    .arg(&task.input)
                    .stderr(Stdio::inherit())
                    .output() {
                    Ok(cmd) => { cmd }
                    Err(err) => {
                        return Err(Error::msg(format!("This server doesn't support thumbnails because ffmpeg is not available : {}", err)))
                    }
                };
                let duration = match f32::from_str(String::from_utf8(get_duration_cmd.stdout)?.as_str()) {
                    Ok(duration) => { duration }
                    Err(_) => { 0f32 }
                };

                let cmd = match Command::new("ffmpeg")
                    .arg("-v")
                    .arg("error")
                    .arg("-ss")
                    .arg((duration / 2f32).to_string())
                    .arg("-i")
                    .arg(&task.input)
                    .arg("-vf")
                    .arg(format!("scale={}:{}:force_original_aspect_ratio=decrease", task.size, task.size))
                    .arg("-vframes")
                    .arg("1")
                    .arg("-f")
                    .arg("webp")
                    .arg(&task.output)
                    .stderr(Stdio::inherit())
                    .spawn() {
                    Ok(cmd) => { cmd }
                    Err(err) => {
                        return Err(Error::msg(format!("This server doesn't support thumbnails because ffmpeg is not available : {}", err)))
                    }
                };
                cmd.wait_with_output()?;
                Ok(true)
            }
            _ => {
                Ok(false)
            }
        }
    }
}