use crate::file_to_images::Processor;
use crate::ThumbnailerTask;
use anyhow::{anyhow, Error};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::{env, fs};

pub struct Object3DToImage;

impl Object3DToImage {

    pub fn available() -> Result<(), Error> {
        match Command::new("f3d").arg("--version").output() {
            Ok(_) => {Ok(())}
            Err(err) => {
                Err(anyhow!("Requires f3d : {err}"))
            }
        }
    }

    pub fn process_3d_object(task: &ThumbnailerTask, temp_path: PathBuf) -> Result<(), Error> {
        if !temp_path.exists() {
            return Err(Error::msg(format!("Cannot find object3d file : {}", temp_path.display())));
        }

        let cmd = match Command::new("f3d")
            .arg("--no-background")
            .arg("--max-size=300")
            .arg("--grid=false")
            .arg("--light-intensity=2")
            .arg("--filename=false")
            .arg("--metadata=false")
            .arg("--axis=false")
            .arg("--edges=false")
            .arg("--interaction-trackball=false")
            .arg(format!("--resolution={},{}", task.size, task.size))
            .arg(format!("--output={}", task.output.display()))
            .arg(temp_path.display().to_string())
            .stderr(Stdio::inherit())
            .stdout(Stdio::inherit())
            .spawn() {
            Ok(cmd) => { cmd }
            Err(err) => {
                fs::remove_file(&temp_path)?;
                return Err(Error::msg(format!("This server doesn't support thumbnails because f3d is not available : {}", err)))
            }
        };
        if let Err(err) = cmd.wait_with_output() {
            fs::remove_file(&temp_path)?;
            Err(err)?;
        };
        if temp_path.exists() {
            fs::remove_file(&temp_path)?;
        }
        Ok(())
    }
}

impl Processor for Object3DToImage {
    fn name(&self) -> String {
        "object 3D to image".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        Self::available()
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        match task.extension.to_lowercase().as_str() {
            "obj" | "fbx" | "stl" | "dae" | "ply" | "glb" | "gltf" | "x3d" | "x3db" | "3ds" => {
                let mut temp_path = env::temp_dir().join("fileshare_3D_thumbnail").join(task.input.file_name().unwrap_or(OsStr::new("noname")));
                temp_path.set_extension(&task.extension);
                fs::create_dir_all(temp_path.parent().unwrap())?;

                if temp_path.exists() {
                    fs::remove_file(&temp_path)?;
                }
                #[cfg(unix)]
                if let Err(err) = std::os::unix::fs::symlink(&task.input, &temp_path) {
                    return Err(Error::msg(format!("Failed to create symlink : {}", err)));
                }
                #[cfg(windows)]
                fs::copy(&task.input, &temp_path)?;

                Self::process_3d_object(task, temp_path)?;
                Ok(true)
            }
            &_ => { Ok(false) }
        }
    }
}