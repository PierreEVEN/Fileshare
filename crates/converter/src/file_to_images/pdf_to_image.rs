use crate::converter_error::ConverterError;
use crate::{Converter, ConverterTask, ToolPool};
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tracing::info;

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
        Ok((task.output.clone(), "image/webp".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
            fs::create_dir_all(task.output.parent().unwrap())?;
            let res = tool_pool.create_cmd("mogrify")?
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
            if !res.status.success() {
                return Err(ConverterError::ConversionFailed(String::from_utf8_lossy(&res.stderr).to_string()))
            }
            
            let mut generated_file_name = task.output.clone();
            generated_file_name.set_extension("webp");
            fs::rename(generated_file_name, &task.output)?;
            info!("Successfully exported pdf file to image : {}", task.output.display());
            Ok(())
        } else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}