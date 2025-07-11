use std::hash::{Hash, Hasher};
use std::path::PathBuf;

#[derive(Clone)]
pub struct StreamReference {
    file: PathBuf,
    stream_identifier: String
}

impl StreamReference {
    pub fn new(file: PathBuf, stream_identifier: String) -> Self {
        Self {
            file,
            stream_identifier,
        }
    }

    pub fn path(&self) -> &PathBuf {
        &self.file
    }

    pub fn id(&self) -> &String {
        &self.stream_identifier
    }
}

impl Hash for StreamReference {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.stream_identifier.hash(state);
    }
}

impl Eq for StreamReference {}

impl PartialEq for StreamReference {
    fn eq(&self, other: &Self) -> bool {
        self.stream_identifier.eq(&other.stream_identifier)
    }
}