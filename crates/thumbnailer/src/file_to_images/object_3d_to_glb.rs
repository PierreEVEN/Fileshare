use crate::file_to_images::Processor;
use crate::ThumbnailerTask;
use anyhow::{anyhow, Error};
use std::ffi::OsStr;
use std::process::{Command, Stdio};
use std::{env, fs, io};
use std::path::Path;

pub struct Object3dToGlb;

fn safe_rename(src: &Path, dst: &Path) -> io::Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::CrossesDevices => {
            fs::copy(src, dst)?;
            fs::remove_file(src)
        }
        Err(e) => Err(e),
    }
}

impl Processor for Object3dToGlb {
    fn name(&self) -> String {
        "object 3D to GLB".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        match Command::new("assimp").arg("version").output() {
            Ok(_) => Ok(()),
            Err(err) => Err(anyhow!("Requires assimp : {err}")),
        }
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        match task.extension.to_lowercase().as_str() {
            "obj" | "fbx" | "stl" | "dae" | "ply" | "glb" | "gltf" | "x3d" | "x3db" | "3ds" => {
                let file_name = task
                    .input
                    .file_name()
                    .unwrap_or(OsStr::new("noname"))
                    .to_str()
                    .unwrap_or("invalid_str");

                let mut temp_path_in = env::temp_dir()
                    .join("fileshare_3D_thumbnail")
                    .join(String::from("in_") + file_name);
                temp_path_in.set_extension(&task.extension);
                fs::create_dir_all(temp_path_in.parent().unwrap())?;

                if temp_path_in.exists() {
                    fs::remove_file(&temp_path_in)?;
                }
                #[cfg(unix)]
                if let Err(err) = std::os::unix::fs::symlink(&task.input, &temp_path_in) {
                    return Err(Error::msg(format!("Failed to create symlink : {}", err)));
                }
                #[cfg(windows)]
                fs::copy(&task.input, &temp_path_in)?;

                let mut temp_path_out = env::temp_dir()
                    .join("fileshare_3D_thumbnail")
                    .join(String::from("out_") + file_name);
                temp_path_out.set_extension("glb");

                let cmd = match Command::new("assimp")
                    .arg("export")
                    .arg(&temp_path_in)
                    .arg(&temp_path_out)
                    .stderr(Stdio::inherit())
                    .stdout(Stdio::inherit())
                    .spawn()
                {
                    Ok(cmd) => cmd,
                    Err(err) => {
                        fs::remove_file(&temp_path_in)?;
                        #[allow(unused)]
                        fs::remove_file(&temp_path_out);
                        return Err(Error::msg(format!("This server doesn't support preview because assimp is not available : {}", err)));
                    }
                };
                if let Err(err) = cmd.wait_with_output() {
                    fs::remove_file(&temp_path_in)?;
                    #[allow(unused)]
                    fs::remove_file(&temp_path_out);
                    Err(err)?;
                };
                fs::remove_file(&temp_path_in)?;
                if temp_path_out.exists() {
                    if !task.output.parent().unwrap().exists() {
                        fs::create_dir_all(task.output.parent().unwrap())?;
                    }
                    safe_rename(&temp_path_out, &task.output).map_err(|err| Error::msg(format!("Failed to rename generated glb from {} to {} : {err}", temp_path_out.display(), task.output.display())))?;
                    Ok(true)
                } else {
                    Ok(false)
                }
            }
            _ => Ok(false),
        }
    }
}
