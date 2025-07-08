use crate::error::StreamingError;
use std::fmt::{Display, Formatter};
use std::{fs, path};
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct PresetRef {
    track_index: u32,
    preset: String,
    source: PathBuf
}

impl PresetRef {
    pub fn new (track_index: u32, preset: String, source: PathBuf) -> Self {
        Self {
            track_index,
            preset,
            source,
        }
    }

    pub fn init_directories(&self, video_server_cache: &PathBuf) -> Result<(), StreamingError> {
        Ok(fs::create_dir_all(path::absolute(video_server_cache.join(PathBuf::from(&self.source.file_name().unwrap()).join(self.track_index.to_string()).join(&self.preset)))?)?)
    }
    pub fn init_path(&self, video_server_cache: &PathBuf, start_num: u32) -> PathBuf {
        video_server_cache.join(PathBuf::from(&self.source.file_name().unwrap()).join(self.track_index.to_string()).join(&self.preset).join(format!("{start_num}_init.mp4")))
    }
    pub fn chunk_path(&self, video_server_cache: &PathBuf, chunk: String) -> PathBuf {
        video_server_cache.join(PathBuf::from(&self.source.file_name().unwrap()).join(self.track_index.to_string()).join(&self.preset).join(format!("{chunk}.m4s")))
    }
    pub fn playlist_path(&self, video_server_cache: &PathBuf) -> PathBuf {
        video_server_cache.join(PathBuf::from(&self.source.file_name().unwrap()).join(self.track_index.to_string()).join(&self.preset).join("playlist.m3u8"))
    }
}

impl Display for PresetRef {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        self.preset.fmt(f)
    }
}

impl Hash for PresetRef {
    fn hash<H: Hasher>(&self, state: &mut H) {
        u32::hash(&self.track_index, state);
        String::hash(&self.preset, state);
        PathBuf::hash(&self.source, state);
    }
}
