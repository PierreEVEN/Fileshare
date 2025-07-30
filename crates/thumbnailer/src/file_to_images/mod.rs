pub mod pdf_to_image;
pub mod image_to_thumbnail;
pub mod video_to_image;
pub mod blender_to_image;
pub mod object_3d_to_image;
pub mod object_3d_to_glb;
pub mod cr2_to_image;
pub mod blender_to_glb;

use anyhow::Error;
use crate::ThumbnailerTask;

pub trait Processor : Send + Sync {
    fn name(&self) -> String;
    fn available(&self) -> Result<(), Error>;
    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error>;
}
