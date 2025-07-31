use std::{fs, io};
use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use tracing::error;
use crate::TempPath;

pub fn safe_rename(src: &Path, dst: &Path) -> io::Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::CrossesDevices => {
            fs::copy(src, dst)?;
            fs::remove_file(src)
        }
        Err(e) => Err(e),
    }
}


impl TempPath {
    pub fn new(path: PathBuf) -> Self {
        Self(path, false)
    }

    pub fn forget(&mut self) {
        self.1 = true;
    }
}

impl Deref for TempPath {
    type Target = PathBuf;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for TempPath {
    fn deref_mut(&mut self) -> &mut PathBuf {
        &mut self.0
    }
}

impl Drop for TempPath {
    fn drop(&mut self) {
        if self.0.exists() && !self.1 {
            if let Err(err) = fs::remove_file(&self.0) {
                error!("Failed to remove unused temporary file {} : {}", self.0.display(), err)
            }
        }
    }
}
