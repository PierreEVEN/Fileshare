use crate::repository::Repository;
use anyhow::Error;
use paris::success;
use crate::content::meta_dir::MetaDir;

pub struct ActionLogin {}

impl ActionLogin {
    pub async fn run(username: Option<String>) -> Result<Repository, Error> {
        let mut repos = Repository::new(MetaDir::search_here()?)?;
        repos.connection_mut().authenticate(username).await?;
        success!("Successfully logged in !");
        Ok(repos)
    }
}