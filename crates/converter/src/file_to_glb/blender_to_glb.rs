use std::{fs};
use std::path::{PathBuf};
use std::process::{Stdio};
use std::sync::Arc;
use tracing::info;
use crate::{Converter, ConverterTask, TempPath, ToolPool};
use crate::converter_error::ConverterError;

#[derive(Default)]
pub struct BlenderToGlb;

impl BlenderToGlb {
    pub fn available(tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("blender")?;
        Ok(())
    }

    pub fn process_3d_object(task: &ConverterTask, tool_pool: &Arc<ToolPool>, output_file_path: &TempPath) -> Result<(), ConverterError> {
        if output_file_path.exists() {
            fs::remove_file(output_file_path.as_path())?;
        }
        let mut export_path = PathBuf::from(output_file_path.as_path());
        export_path.set_extension("glb");
        
        let script = format!(r"import bpy;bpy.ops.wm.open_mainfile(filepath=r'{}');bpy.ops.export_scene.gltf(filepath=r'{}',export_format='GLB',export_apply=True)", task.input.display(), export_path.display());
        tool_pool.create_cmd("blender")?
            .arg("--background")
            .arg("--python-expr")
            .arg(script)
            .stderr(Stdio::inherit())
            .stdout(Stdio::null())
            .spawn()?
            .wait_with_output()?;
        fs::rename(export_path, output_file_path.as_path())?;

        if output_file_path.exists() {
            info!("Successfully exported blend file to glb : {}", output_file_path.display());
            Ok(())
        }
        else {
            Err(ConverterError::ConversionFailed(format!("Conversion from blend to glb failed : output file not found at {}", output_file_path.display())))
        }
    }
}

impl Converter for BlenderToGlb {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        tool_pool.create_cmd("blender")?;
        Ok(())
    }

    fn accept(&self, task: &ConverterTask, _: &Arc<ToolPool>) -> Result<bool, ConverterError> {
        Ok(task.extension.to_lowercase().as_str() == "blend")
    }

    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError> {
        Ok((task.output.clone(), "model/gltf-binary".to_string()))
    }

    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError> {
        if self.accept(task, tool_pool)? {
            let mut output = TempPath::new(task.output.clone());
            Self::process_3d_object(task, tool_pool, &output)?;
            output.forget();
            Ok(())
        } else {
            Err(ConverterError::TaskNotAcceptable)
        }
    }
}