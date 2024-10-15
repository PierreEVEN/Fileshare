use anyhow::Error;
use paris::info;
use crate::content::meta_dir::MetaDir;
use crate::repository::Repository;

pub struct ActionInit {}

impl ActionInit {
    pub fn run() -> Result<Repository, Error> {
        let repository = Repository::new(MetaDir::new_here()?)?;
        info!("Successfully initialized a new fileshare repository.");
        Ok(repository)
    }
}