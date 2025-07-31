use crate::converter_error::ConverterError;
use crate::utils::safe_rename;
use crate::{Converter, ConverterTask, TempPath, ToolPool};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::{env, fs};

#[derive(Default)]
pub struct Object3dToGlb;

impl Converter for Object3dToGlb {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("assimp")?;
        Ok(())
    }

    fn accept(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        let output = tool_pool.create_cmd("assimp")?
            .arg("knowext")
            .arg(&task.extension)
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.lines().any(|line| line.trim().contains("is known")) {
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "model/gltf-binary".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {

            let file_name = task
                .input
                .file_name()
                .unwrap_or(OsStr::new("noname"))
                .to_str()
                .unwrap_or("invalid_str");

            let mut temp_path_in = TempPath::new(env::temp_dir()
                .join("fileshare_3D_thumbnail")
                .join(String::from("in_") + file_name));
            temp_path_in.set_extension(&task.extension);
            fs::create_dir_all(temp_path_in.parent().unwrap())?;

            if temp_path_in.exists() {
                fs::remove_file(&*temp_path_in)?;
            }
            #[cfg(unix)]
            if let Err(err) = std::os::unix::fs::symlink(&task.input, &*temp_path_in) {
                return Err(ConverterError::ConversionFailed(format!("Failed to create symlink : {}", err)));
            }
            #[cfg(windows)]
            fs::copy(&task.input, &*temp_path_in)?;

            let mut temp_path_out = TempPath::new(env::temp_dir()
                .join("fileshare_3D_thumbnail")
                .join(String::from("out_") + file_name));
            temp_path_out.set_extension("glb");

            tool_pool.create_cmd("assimp")?
                .arg("export")
                .arg(&*temp_path_in)
                .arg(&*temp_path_out)
                .stderr(Stdio::inherit())
                .stdout(Stdio::inherit())
                .spawn()?
                .wait_with_output()?;

            if temp_path_out.exists() {
                if !task.output.parent().unwrap().exists() {
                    fs::create_dir_all(task.output.parent().unwrap())?;
                }
                safe_rename(&temp_path_out, &task.output).map_err(|err| ConverterError::ConversionFailed(format!("Failed to rename generated glb from {} to {} : {err}", temp_path_out.display(), task.output.display())))?;
                Ok(())
            } else {
                Err(ConverterError::ConversionFailed(format!("Cannot find generated file at {}", temp_path_out.display())))
            }
        } else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}
