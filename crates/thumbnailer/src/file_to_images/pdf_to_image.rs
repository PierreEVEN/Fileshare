use crate::file_to_images::Processor;
use crate::ThumbnailerTask;
use anyhow::Error;
use std::ffi::OsString;
use std::fs;
use std::process::{Command, Stdio};

pub struct PdfToImage;

impl Processor for PdfToImage {
    fn name(&self) -> String {
        "pdf to image".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        match Command::new("magick")
            .arg("-list")
            .arg("delegate")
            .output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.lines().any(|line| line.trim().starts_with("pdf")) {
                    Ok(())
                } else {
                    Err(Error::msg("Imagemagick does not support pdf format : check if ghostscript is installed"))
                }
            }
            Err(err) => {
                Err(Error::msg(format!("Imagemagick is required : {err}")))
            }
        }
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        if task.mimetype.contains("pdf") {
            fs::create_dir_all(task.output.parent().unwrap())?;
            let cmd = match Command::new("mogrify")
                .arg("-format")
                .arg("webp")
                .arg("-interlace")
                .arg("plane")
                .arg("-quality")
                .arg("70%")
                .arg("-alpha")
                .arg("remove")
                .arg("-path")
                .arg(task.output.parent().unwrap())
                .arg("-thumbnail")
                .arg(format!("{}x{}", task.size, task.size))
                .arg("-auto-orient")
                .arg(format!("{}[0]", task.input.display()))
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
        } else {
            Ok(false)
        }
    }
}