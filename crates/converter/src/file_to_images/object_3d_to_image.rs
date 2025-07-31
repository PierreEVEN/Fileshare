use crate::converter_error::ConverterError;
use crate::{Converter, ConverterTask, TempPath, ToolPool};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::{env, fs};
use tracing::info;

#[derive(Default)]
pub struct Object3DToImage;

impl Object3DToImage {
    pub fn available(tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("f3d")?;
        Ok(())
    }

    pub fn process_3d_object(task: &ConverterTask, tool_pool: &Arc<ToolPool>, input_file_path: &TempPath) -> Result<(), ConverterError> {
        if !input_file_path.exists() {
            return Err(ConverterError::InvalidInput(format!("Cannot find object3d file : {}", input_file_path.display())));
        }
        if task.output.exists() {
            fs::remove_file(task.output.as_path())?;
        }
        tool_pool.create_cmd("f3d")?
            .arg("--no-background")
            .arg("--max-size=300")
            .arg("--grid=false")
            .arg("--light-intensity=2")
            .arg("--filename=false")
            .arg("--metadata=false")
            .arg("--axis=false")
            .arg("--edges=false")
            .arg("--interaction-trackball=false")
            .arg(if let Some(size) = task.output_max_size { format!("--resolution={},{}", size, size)} else {String::new()})
            .arg(format!("--output={}", task.output.display()))
            .arg(input_file_path.display().to_string())
            .stderr(Stdio::inherit())
            .stdout(Stdio::inherit())
            .spawn()?
            .wait_with_output()?;

        if task.output.exists() {
            info!("Successfully exported object3d file to webp : {}", task.output.display());
            Ok(())
        }
        else {
            Err(ConverterError::ConversionFailed(format!("Conversion from object3d to image failed : output file not found at {}", task.output.display())))
        }
    }
}

impl Converter for Object3DToImage {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        Self::available(tool_pool)
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        match task.extension.to_lowercase().as_str() {
            "obj" | "fbx" | "stl" | "dae" | "ply" | "glb" | "gltf" | "x3d" | "x3db" | "3ds" => {
                Ok(true)
            }
            _ => {
                Ok(false)
            }
        }
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "image/webp".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
            let mut temp_path = TempPath::new(env::temp_dir().join("fileshare_3D_thumbnail").join(task.input.file_name().unwrap_or(OsStr::new("noname"))));
            temp_path.set_extension(&task.extension);
            fs::create_dir_all(temp_path.parent().unwrap())?;

            if temp_path.exists() {
                fs::remove_file(&*temp_path)?;
            }
            #[cfg(unix)]
            if let Err(err) = std::os::unix::fs::symlink(&task.input, &*temp_path) {
                return Err(ConverterError::ConversionFailed(format!("Failed to create symlink : {}", err)));
            }
            #[cfg(windows)]
            fs::copy(&task.input, &*temp_path)?;

            Self::process_3d_object(task, tool_pool, &temp_path)?;
            Ok(())
        }
        else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}