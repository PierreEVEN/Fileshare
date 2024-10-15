use crate::cli::RemoteCommands;
use crate::repository::Repository;
use anyhow::Error;
use paris::{info, warn};
use crate::content::meta_dir::MetaDir;

pub struct ActionRemote {}

impl ActionRemote {
    pub async fn run(subcommand: Option<RemoteCommands>) -> Result<Repository, Error> {
        Ok(match subcommand {
            None => {
                let mut repos = Repository::new(MetaDir::search_here()?)?;
                match repos.connection_mut().ping_repository().await {
                    Ok(repository) => {
                        info!("{}", repository.display_name.plain()?);
                    }
                    Err(_) => {
                        warn!("Remote url is not set");
                    }
                }
                repos
            }
            Some(remote) => {
                match remote {
                    RemoteCommands::Set { url } => {
                        let mut repos = Repository::new(MetaDir::search_here()?)?;
                        repos.connection_mut().set_public_url(url.as_str()).await?;
                        match repos.connection_mut().ping_repository().await {
                            Ok(repository) => {
                                info!("Updated remote url to '{}'", repository.display_name.plain()?);
                            }
                            Err(error) => {
                                return Err(Error::msg(format!("Invalid remote url : {error}")));
                            }
                        }
                        repos
                    }
                }
            }
        })
    }
}