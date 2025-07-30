use std::{env, fs};
use std::ffi::OsStr;
use std::process::{Command, Stdio};
use anyhow::{anyhow, Error};
use tracing::info;
use crate::file_to_images::object_3d_to_image::Object3DToImage;
use crate::file_to_images::Processor;
use crate::{ThumbnailerTask};

pub struct BlenderToImage;

impl Processor for BlenderToImage {
    fn name(&self) -> String {
        "blender to image".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        Object3DToImage::available()?;
        match Command::new("blender").arg("--version").output() {
            Ok(_) => {Ok(())}
            Err(err) => {
                Err(anyhow!("Requires blender : {err}"))
            }
        }
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        match task.extension.to_lowercase().as_str() {
            "blend" => {
                let mut temp_path = env::temp_dir().join("fileshare_3D_thumbnail").join(task.input.file_name().unwrap_or(OsStr::new("noname")));
                temp_path.set_extension(&task.extension);
                fs::create_dir_all(temp_path.parent().unwrap())?;
                temp_path.set_extension("glb");
                if temp_path.exists() {
                    fs::remove_file(&temp_path)?;
                }
                let script = format!(r"import bpy;bpy.ops.wm.open_mainfile(filepath=r'{}');bpy.ops.export_scene.gltf(filepath=r'{}',export_format='GLB',export_apply=True)", task.input.display().to_string(), temp_path.display());
                let cmd = match Command::new("blender")
                    .arg("--background")
                    .arg("--python-expr")
                    .arg(script)
                    .stderr(Stdio::inherit())
                    .stdout(Stdio::inherit())
                    .spawn() {
                    Ok(cmd) => { cmd }
                    Err(err) => {
                        #[allow(unused)]
                        fs::remove_file(&temp_path);
                        return Err(Error::msg(format!("This server doesn't support thumbnails because blender is not available : {}", err)))
                    }
                };

                if let Err(err) = cmd.wait_with_output() {
                    fs::remove_file(&temp_path)?;
                    Err(err)?;
                };
                if temp_path.exists() {
                    info!("Successfully exported blend file to glb : {}", temp_path.display());
                }
                else {
                    return Err(Error::msg("Unable to export blend file to glb"));
                }
                Object3DToImage::process_3d_object(task, temp_path)?;
                Ok(true)
            }
            &_ => { Ok(false) }
        }
    }
}