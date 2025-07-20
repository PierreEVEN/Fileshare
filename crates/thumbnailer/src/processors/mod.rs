pub mod pdf;
pub mod image;
pub mod video;
pub mod blender;
pub mod object_3d;

use anyhow::Error;
use crate::ThumbnailerTask;

pub trait Processor : Send + Sync {
    fn name(&self) -> String;
    fn available(&self) -> Result<(), Error>;
    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error>;
}
