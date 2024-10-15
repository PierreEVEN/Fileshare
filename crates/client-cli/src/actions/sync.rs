use crate::content::diff::Diff;
use crate::repository::Repository;
use anyhow::Error;
use crate::content::meta_dir::MetaDir;

pub struct ActionSync {

}

impl ActionSync {
    pub async fn run() -> Result<Repository, Error> {
        let mut repos = Repository::new(MetaDir::search_here()?)?;
        let diff = Diff::from_repository(&mut repos).await?;
        repos.apply_actions(diff.actions()).await?;
        Ok(repos)
    }
}