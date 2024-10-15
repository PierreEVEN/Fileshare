use crate::repository::Repository;
use anyhow::Error;
use crate::content::meta_dir::MetaDir;

pub struct ActionLogout {

}

impl ActionLogout {
    pub async fn run() -> Result<Repository, Error> {
        let mut repos = Repository::new(MetaDir::search_here()?)?;
        repos.connection_mut().logout().await?;
        Ok(repos)
    }
}