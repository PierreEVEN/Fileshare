use std::fmt::{Display, Formatter};

#[derive(Debug, Clone)]
pub enum ContentType {
    Video,
    Audio,
    Subtitles,
}

impl ContentType {
    pub fn mime(&self) -> &str {
        match self {
            ContentType::Video => {"video/mp4"}
            ContentType::Audio => {"audio/mp4"}
            ContentType::Subtitles => {"unknown/unknown"}
        }
    }
}

impl Display for ContentType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            ContentType::Video => "video",
            ContentType::Audio => "audio",
            ContentType::Subtitles => "subtitles",
        })
    }
}
