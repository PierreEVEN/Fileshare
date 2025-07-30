use std::{fs, io};
use std::path::Path;

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