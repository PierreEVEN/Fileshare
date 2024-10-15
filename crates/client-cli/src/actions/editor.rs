use crate::cli::EditorCommands;
use crate::repository::Repository;
use anyhow::Error;
use paris::{info, warn};
use crate::content::meta_dir::MetaDir;

pub struct ActionEditor {}

impl ActionEditor {
    pub fn run(subcommand: Option<EditorCommands>) -> Result<Repository, Error>
    {
        Ok(match subcommand {
        None => {
            let repos = Repository::new(MetaDir::search_here()?)?;
            if repos.get_editor_command().is_empty() {
                warn!("Editor executable path is not set");
            } else {
                info!("{}", repos.get_editor_command());
            }
            repos
        }
        Some(remote) => {
            match remote {
                EditorCommands::Set { url } => {
                    let mut repos = Repository::new(MetaDir::search_here()?)?;
                    repos.set_editor_command(url);
                    info!("Updated editor executable path to '{}'", repos.get_editor_command());
                    repos
                }
            }
        }
    })
    }
}