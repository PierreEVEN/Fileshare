use std::{env, fs};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::Arc;
use crate::file_to_images::object_3d_to_image::Object3DToImage;
use crate::{Converter, ConverterTask, TempPath, ToolPool};
use crate::converter_error::ConverterError;
use crate::file_to_glb::blender_to_glb::BlenderToGlb;

#[derive(Default)]
pub struct BlenderToImage;

impl Converter for BlenderToImage {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        BlenderToGlb::available(tool_pool)?;
        Object3DToImage::available(tool_pool)?;
        Ok(())
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        Ok(task.extension.to_lowercase().as_str() == "blend")
    }


    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "image/webp".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        let mut temp_glb = TempPath::new(env::temp_dir().join("fileshare_3D_thumbnail").join(task.input.file_name().unwrap_or(OsStr::new("noname"))));
        temp_glb.set_extension(&task.extension);
        fs::create_dir_all(temp_glb.parent().unwrap())?;
        temp_glb.set_extension("glb");
        BlenderToGlb::process_3d_object(task, tool_pool, &temp_glb)?;
        Object3DToImage::process_3d_object(task, tool_pool, &temp_glb)?;
        Ok(())
    }
}