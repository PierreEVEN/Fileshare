use crate::content::diff::Diff;
use crate::repository::Repository;
use anyhow::Error;
use crate::content::meta_dir::MetaDir;

pub struct ActionClone {}

impl ActionClone {
    pub async fn run(repository_url: String) -> Result<Repository, Error> {
        let mut repository = Repository::new(MetaDir::new_create(&repository_url)?)?;
        repository.connection_mut().set_public_url(repository_url.as_str()).await?;
        let diff = Diff::from_repository(&mut repository).await?;
        repository.apply_actions(diff.actions()).await?;
        Ok(repository)
    }
}