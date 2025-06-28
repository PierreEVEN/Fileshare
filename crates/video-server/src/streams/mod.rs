use std::io;
use xmlwriter::XmlWriter;

pub mod video_transmux;
pub mod video_transcode;

pub enum ContentType {
    Video,
    Audio,
    Subtitles
}

pub trait Stream {
    fn build_manifest(&self, w: &mut XmlWriter, start_num: u32);
    fn build_args(&self) -> Result<Vec<String>, io::Error>;
    fn content_type(&self) -> ContentType;
}
