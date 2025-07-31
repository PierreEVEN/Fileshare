use crate::converter_error::ConverterError;
use crate::{Converter, ConverterTask, ToolPool};
use std::ffi::OsString;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

#[derive(Default)]
pub struct ImageNoWebToImage;

impl Converter for ImageNoWebToImage {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("mogrify")?;
        Ok(())
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        Ok(matches!(task.mimetype.as_str(), "image/x-canon-cr2" | "image/cr2" | "image/tga" | "image/x-tga"))
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "image/webp".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
            fs::create_dir_all(task.output.parent().unwrap())?;
            let mime_plain = match task.mimetype.as_str() {
                "image/x-canon-cr2" => {
                    "image/cr2"
                }
                "image/x-tga" => {
                    "image/tga"
                }
                mime => {mime}
            };
            let mut mime = mime_plain.split("/");
            mime.next();
            let mut path_str = OsString::from(mime.next().ok_or(ConverterError::InvalidInput(format!("invalid mimetype : {}", mime_plain)))?);
            path_str.push(":");
            path_str.push(task.input.as_os_str());

            let res = tool_pool.create_cmd("mogrify")?
                .arg("-format")
                .arg("webp")
                .arg("-interlace")
                .arg("plane")
                .arg("-quality")
                .arg("90%")
                .arg("-path")
                .arg(task.output.parent().unwrap())
                .arg("-auto-orient")
                .arg(&path_str)
                .stderr(Stdio::inherit())
                .stdout(Stdio::inherit())
                .spawn()?
                .wait_with_output()?;
            if !res.status.success() {
                return Err(ConverterError::ConversionFailed(String::from_utf8_lossy(&res.stderr).to_string()))
            }
            
            let mut generated_file_name = PathBuf::from(&task.output);
            generated_file_name.set_extension("webp");
            fs::rename(generated_file_name, &task.output)?;
            Ok(())
        }
        else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}