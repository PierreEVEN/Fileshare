use anyhow::Error;
use std::ffi::{OsStr, OsString};
use std::{env, fs};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::str::FromStr;
use tracing::info;

pub struct Thumbnail {}

impl Thumbnail {
    fn video_thumbnail(input_path: &PathBuf, output_path: &PathBuf, size: u32) -> Result<(), Error> {
        let get_duration_cmd = match Command::new("ffprobe")
            .arg("-v")
            .arg("error")
            .arg("-show_entries")
            .arg("format=duration")
            .arg("-of")
            .arg("default=noprint_wrappers=1:nokey=1")
            .arg(input_path)
            .stderr(Stdio::inherit())
            .output() {
            Ok(cmd) => { cmd }
            Err(err) => {
                return Err(Error::msg(format!("This server doesn't support thumbnails because ffmpeg is not available : {}", err)))
            }
        };
        let duration = match f32::from_str(String::from_utf8(get_duration_cmd.stdout)?.as_str()) {
            Ok(duration) => { duration }
            Err(_) => { 0f32 }
        };

        let cmd = match Command::new("ffmpeg")
            .arg("-v")
            .arg("error")
            .arg("-ss")
            .arg((duration / 2f32).to_string())
            .arg("-i")
            .arg(input_path)
            .arg("-vf")
            .arg(format!("scale={size}:{size}:force_original_aspect_ratio=decrease"))
            .arg("-vframes")
            .arg("1")
            .arg("-f")
            .arg("webp")
            .arg(output_path)
            .stderr(Stdio::inherit())
            .spawn() {
            Ok(cmd) => { cmd }
            Err(err) => {
                return Err(Error::msg(format!("This server doesn't support thumbnails because ffmpeg is not available : {}", err)))
            }
        };
        cmd.wait_with_output()?;
        Ok(())
    }

    fn image_thumbnail(input_path: &Path, output_path: &PathBuf, mimetype: &String, size: u32) -> Result<(), Error> {
        fs::create_dir_all(output_path.parent().unwrap())?;
        let mime_plain = match mimetype.as_str() {
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
            plain => { plain }
        };
        let mut mime = mime_plain.split("/");
        mime.next();
        let mut path_str = OsString::from(mime.next().ok_or(Error::msg(format!("invalid mimetype : {}", mime_plain)))?);
        path_str.push(":");
        path_str.push(input_path.as_os_str());

        let cmd = match Command::new("mogrify")
            .arg("-format")
            .arg("webp")
            .arg("-interlace")
            .arg("plane")
            .arg("-quality")
            .arg("70%")
            .arg("-path")
            .arg(output_path.parent().unwrap())
            .arg("-thumbnail")
            .arg(format!("{size}x{size}"))
            .arg("-auto-orient")
            .arg(&path_str)
            .stderr(Stdio::inherit())
            .stdout(Stdio::inherit())
            .spawn() {
            Ok(cmd) => { cmd }
            Err(err) => {
                return Err(Error::msg(format!("This server doesn't support thumbnails because imagemagick is not available : {}", err)))
            }
        };
        cmd.wait_with_output()?;

        let mut generated_file_name = OsString::from(output_path.file_name().unwrap());
        generated_file_name.push(".webp");
        fs::rename(output_path.parent().unwrap().join(generated_file_name), output_path)?;
        Ok(())
    }

    fn object3d_thumbnail(input_path: &Path, extension: &String, output_path: &PathBuf, size: u32) -> Result<(), Error> {
        let mut temp_path = env::temp_dir().join("fileshare_3D_thumbnail").join(input_path.file_name().unwrap_or(OsStr::new("noname")));
        temp_path.set_extension(extension);
        fs::create_dir_all(temp_path.parent().unwrap())?;

        if extension == "blend" {
            temp_path.set_extension("glb");
            if temp_path.exists() {
                fs::remove_file(&temp_path)?;
            }
            let script = format!(r"import bpy;bpy.ops.wm.open_mainfile(filepath=r'{}');bpy.ops.export_scene.gltf(filepath=r'{}',export_format='GLB',export_apply=True)", input_path.display().to_string(), temp_path.display());
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
        } else {
            if temp_path.exists() {
                fs::remove_file(&temp_path)?;
            }
            #[cfg(unix)]
            if let Err(err) = std::os::unix::fs::symlink(input_path, &temp_path) {
                return Err(Error::msg(format!("Failed to create symlink : {}", err)));
            }
            #[cfg(windows)]
            fs::copy(input_path, &temp_path)?;
        }

        if !temp_path.exists() {
            return Err(Error::msg(format!("Cannot find object3d file : {}", temp_path.display())));
        }

        let cmd = match Command::new("f3d.exe")
            .arg("--no-background")
            .arg("--max-size=300")
            .arg("--grid=false")
            .arg("--light-intensity=2")
            .arg("--filename=false")
            .arg("--metadata=false")
            .arg("--axis=false")
            .arg("--edges=false")
            .arg("--interaction-trackball=false")
            .arg(format!("--resolution={size},{size}"))
            .arg(format!("--output={}", output_path.display()))
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

    fn pdf_thumbnail(input_path: &PathBuf, output_path: &PathBuf, size: u32) -> Result<(), Error> {
        use pdfium_render::prelude::*;

        // binaries available at https://github.com/bblanchon/pdfium-binaries/releases
        let path = if cfg!(target_pointer_width = "64") {
            if cfg!(target_os = "windows") {
                Some(env::current_exe()?.parent().unwrap().join("pdfium.dll"))
            } else if cfg!(target_os = "linux") {
                Some(env::current_exe()?.parent().unwrap().join("libpdfium.so"))
            } else { None }
        } else { None };


        let path = if let Some(path) = path {
            path
        } else {
            return Err(Error::msg("Failed to find pdfium binary"));
        };

        if !path.exists() {
            return Err(Error::msg(format!("Invalid pdfium dll path : {}", path.display())));
        }


        let bindings = match Pdfium::bind_to_library(path) {
            Ok(bindings) => {
                Ok(bindings)
            }
            Err(err) => {
                Err(Error::msg(format!("Failed to link pdfium : {err}")))
            }
        };

        let pdfium = Pdfium::new(bindings?);
        let document = pdfium.load_pdf_from_file(input_path, None)?;

        let render_config = PdfRenderConfig::new()
            .set_target_width(size as Pixels)
            .set_maximum_height(size as Pixels)
            .rotate_if_landscape(PdfPageRenderRotation::Degrees90, true);

        document.pages().first()?.render_with_config(&render_config)?
            .as_image()
            .into_rgb8()
            .save_with_format(
                output_path,
                image::ImageFormat::WebP,
            )
            .map_err(|err| {Error::msg(format!("Failed to render PDF thumbnail : {err} (source file path : '{}' to '{}')", input_path.display(), output_path.display()))})?;
        Ok(())
    }

    pub fn create(input_path: &PathBuf, output_path: &PathBuf, mimetype: &String, extension: &String, size: u32) -> Result<PathBuf, Error> {
        if !input_path.exists() {
            return Err(Error::msg(format!("Cannot create thumbnail : the source file {} does not exists", input_path.display())))
        }
        if mimetype.contains("pdf") {
            Self::pdf_thumbnail(input_path, output_path, size)?;
            return Ok(output_path.clone());
        }

        let mut mime_start = mimetype.split("/");
        match mime_start.next().ok_or(Error::msg("Invalid mimetype"))? {
            "image" => {
                Self::image_thumbnail(input_path, output_path, mimetype, size)?;
            }
            "video" => {
                Self::video_thumbnail(input_path, output_path, size)?;
            }
            _ => {
                match extension.to_lowercase().as_str() {
                    "obj" | "fbx" | "stl" | "dae" | "ply" | "glb" | "gltf" | "x3d" | "x3db" | "3ds" | "blend" => {
                        Self::object3d_thumbnail(input_path, extension, output_path, size)?;
                    }
                    &_ => { return Err(Error::msg(format!("Unsupported mimetype : {mimetype}"))) }
                };
            }
        }

        Ok(output_path.clone())
    }
    pub fn mimetype<'a>() -> &'a str {
        "image/jpeg"
    }
    pub fn find_or_create(input_path: &PathBuf, output_path: &PathBuf, mimetype: &String, extension: &String, size: u32) -> Result<PathBuf, Error> {
        if output_path.exists() {
            Ok(output_path.clone())
        } else {
            Self::create(input_path, output_path, mimetype, extension, size)
        }
    }
}