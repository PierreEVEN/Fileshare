use std::ffi::OsString;
use std::fs;
use std::process::{Command, Stdio};
use anyhow::{anyhow, Error};
use crate::processors::Processor;
use crate::ThumbnailerTask;

pub struct ImageProcessor;

impl Processor for ImageProcessor {
    fn name(&self) -> String {
        "image".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        match Command::new("mogrify").arg("--version").output() {
            Ok(_) => {Ok(())}
            Err(err) => {
                Err(anyhow!("Requires mogrify : {err}"))
            }
        }
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        let mut mime_start = task.mimetype.split("/");
        match mime_start.next().ok_or(Error::msg("Invalid mimetype"))? {
            "image" => {
                fs::create_dir_all(task.output.parent().unwrap())?;
                let mime_plain = match task.mimetype.as_str() {
                    "image/x-icon" => {
                        "image/ico"
                    }
                    "image/vnd.microsoft.icon" => {
                        "image/ico"
                    }
                    "image/svg+xml" => {
                        "image/svg"
                    }
                    "image/x-canon-cr2" => {
                        "image/cr2"
                    }
                    plain => { plain }
                };
                let mut mime = mime_plain.split("/");
                mime.next();
                let mut path_str = OsString::from(mime.next().ok_or(Error::msg(format!("invalid mimetype : {}", mime_plain)))?);
                path_str.push(":");
                path_str.push(task.input.as_os_str());

                let cmd = match Command::new("mogrify")
                    .arg("-format")
                    .arg("webp")
                    .arg("-interlace")
                    .arg("plane")
                    .arg("-quality")
                    .arg("70%")
                    .arg("-path")
                    .arg(task.output.parent().unwrap())
                    .arg("-thumbnail")
                    .arg(format!("{}x{}", task.size, task.size))
                    .arg("-auto-orient")
                    .arg(&path_str)
                    .stderr(Stdio::inherit())
                    .stdout(Stdio::inherit())
                    .spawn() {
                    Ok(cmd) => { cmd }
                    Err(err) => {
                        return Err(Error::msg(format!("This server doesn't support thumbnails because imagemagick is not available : {}", err)))
                    }
                };
                cmd.wait_with_output()?;

                let mut generated_file_name = OsString::from(task.output.file_name().unwrap());
                generated_file_name.push(".webp");
                fs::rename(task.output.parent().unwrap().join(generated_file_name), &task.output)?;
                Ok(true)
            }
            _ => {
                Ok(false)
            }
        }
    }
}