use crate::converter_error::ConverterError;
use crate::{Converter, ConverterTask, ToolPool};
use std::ffi::OsString;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

#[derive(Default)]
pub struct ImageToThumbnail;

impl Converter for ImageToThumbnail {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("mogrify")?;
        Ok(())
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        let mut mime_start = task.mimetype.split("/");
        Ok(mime_start.next().ok_or(ConverterError::InvalidInput(format!("invalid mimetype : {}", task.mimetype)))? == "image")
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "image/webp".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
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
                "image/x-tga" => {
                    "image/tga"
                }
                plain => { plain }
            };
            let mut mime = mime_plain.split("/");
            mime.next();
            let mut path_str = OsString::from(mime.next().ok_or(ConverterError::InvalidInput(format!("invalid mimetype : {}", mime_plain)))?);
            path_str.push(":");
            path_str.push(task.input.as_os_str());

            tool_pool.create_cmd("mogrify")?
                .arg("-format")
                .arg("webp")
                .arg("-interlace")
                .arg("plane")
                .arg("-quality")
                .arg("70%")
                .arg("-path")
                .arg(task.output.parent().unwrap())
                .args(if let Some(size) = task.output_max_size { vec!["-thumbnail".to_string(), format!("{}x{}", size, size)] } else { vec![] })
                .arg("-auto-orient")
                .arg(&path_str)
                .stderr(Stdio::inherit())
                .stdout(Stdio::inherit())
                .spawn()?
                .wait_with_output()?;

            let mut generated_file_name = OsString::from(task.output.file_name().unwrap());
            generated_file_name.push(".webp");
            fs::rename(task.output.parent().unwrap().join(generated_file_name), &task.output)?;
            Ok(())
        }
        else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}