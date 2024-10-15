mod repository;
mod cli;
mod actions;
pub mod content;
pub mod serialization_utils;

use crate::actions::clone::ActionClone;
use crate::actions::editor::ActionEditor;
use crate::actions::init::ActionInit;
use crate::actions::login::ActionLogin;
use crate::actions::logout::ActionLogout;
use crate::actions::pull::ActionPull;
use crate::actions::push::ActionPush;
use crate::actions::remote::ActionRemote;
use crate::actions::status::ActionStatus;
use crate::actions::sync::ActionSync;
use crate::cli::{FileshareArgs, RootCommands};
use clap::Parser;
use anyhow::Error;
use paris::error;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let args = FileshareArgs::parse();
    match match args.commands {
        RootCommands::Clone { repository_url } => {
            ActionClone::run(repository_url).await
        }
        RootCommands::Init => {
            ActionInit::run()
        }
        RootCommands::Push => {
            ActionPush::run().await
        }
        RootCommands::Pull => {
            ActionPull::run().await
        }
        RootCommands::Sync => {
            ActionSync::run().await
        }
        RootCommands::Status => {
            ActionStatus::run().await
        }
        RootCommands::Logout => {
            ActionLogout::run().await
        }
        RootCommands::Login { name } => {
            ActionLogin::run(name).await
        }
        RootCommands::Editor { editor } => {
            ActionEditor::run(editor)
        }   
        RootCommands::Remote { remote } => {
            ActionRemote::run(remote).await
        }
    } {
        Ok(_) => {}
        Err(error) => {
            error!("{}", error.to_string());
        }
    }
    Ok(())
}
