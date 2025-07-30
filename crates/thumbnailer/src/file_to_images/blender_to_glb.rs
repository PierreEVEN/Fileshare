use std::{env, fs, io};
use std::ffi::OsStr;
use std::path::Path;
use std::process::{Command, Stdio};
use anyhow::{anyhow, Error};
use tracing::info;
use crate::file_to_images::object_3d_to_image::Object3DToImage;
use crate::file_to_images::Processor;
use crate::{ThumbnailerTask};

pub struct BlenderToGlb;

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

impl Processor for BlenderToGlb {
    fn name(&self) -> String {
        "blender to glb".to_string()
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
                let mut temp_out_path = env::temp_dir().join("fileshare_3D_thumbnail").join(task.input.file_name().unwrap_or(OsStr::new("noname")));
                fs::create_dir_all(temp_out_path.parent().unwrap())?;
                temp_out_path.set_extension("glb");
                if temp_out_path.exists() {
                    fs::remove_file(&temp_out_path)?;
                }
                let script = format!(r"import bpy;bpy.ops.wm.open_mainfile(filepath=r'{}');bpy.ops.export_scene.gltf(filepath=r'{}',export_format='GLB',export_apply=True)", task.input.display().to_string(), temp_out_path.display());
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
                        fs::remove_file(&temp_out_path);
                        return Err(Error::msg(format!("This server doesn't support thumbnails because blender is not available : {}", err)))
                    }
                };

                if let Err(err) = cmd.wait_with_output() {
                    fs::remove_file(&temp_out_path)?;
                    Err(err)?;
                };
                if temp_out_path.exists() {
                    if !task.output.parent().unwrap().exists() {
                        fs::create_dir_all(task.output.parent().unwrap())?;
                    }
                    safe_rename(temp_out_path.as_path(), &task.output)?;
                    info!("Successfully exported blend file to glb : {}", task.output.display());
                }
                else {
                    return Err(Error::msg("Unable to export blend file to glb"));
                }
                Ok(true)
            }
            &_ => { Ok(false) }
        }
    }
}