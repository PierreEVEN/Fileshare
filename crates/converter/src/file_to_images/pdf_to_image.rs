use crate::converter_error::ConverterError;
use crate::{Converter, ConverterTask, ToolPool};
use std::ffi::OsString;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

#[derive(Default)]
pub struct PdfToImage;

impl Converter for PdfToImage {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        match tool_pool.create_cmd("magick")?
            .arg("-list")
            .arg("delegate")
            .output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.lines().any(|line| line.trim().starts_with("pdf")) {
                    Ok(())
                } else {
                    Err(ConverterError::ToolNotAvailable("Imagemagick does not support pdf format : check if ghostscript is installed".to_string()))
                }
            }
            Err(err) => { Err(ConverterError::ToolNotAvailable(err.to_string())) }
        }
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        Ok(task.mimetype.contains("pdf"))
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.input.clone(), "application/pdf".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
            fs::create_dir_all(task.output.parent().unwrap())?;
            tool_pool.create_cmd("mogrify")?
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
                .args(if let Some(size) = task.output_max_size { vec!["-thumbnail".to_string(), format!("{}x{}", size, size)] } else { vec![] })
                .arg("-auto-orient")
                .arg(format!("{}[0]", task.input.display()))
                .stderr(Stdio::inherit())
                .stdout(Stdio::inherit())
                .spawn()?
                .wait_with_output()?;

            let mut generated_file_name = OsString::from(task.output.file_name().unwrap());
            generated_file_name.push(".webp");
            fs::rename(task.output.parent().unwrap().join(generated_file_name), &task.output)?;
            Ok(())
        } else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}