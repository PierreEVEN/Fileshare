use clap::{Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[clap(version, about, long_about = None, name="fileshare")]
pub struct FileshareArgs {
    #[command(subcommand)]
    pub commands: RootCommands,
}


#[derive(Debug, clap::ValueEnum, Clone)]
pub enum AutoMergeCases {
    MostRecent,
    KeepOlder
}

#[derive(Debug, Args, Clone)]
pub struct MergeOptions {}

#[derive(Subcommand, Debug)]
pub enum RootCommands {
    /// Create a local copy of the remote repository
    Clone {
        repository_url: String
    },
    /// Make this directory a fileshare repository
    Init,
    /// Send local changes to remote
    Push,
    /// Fetch remote changes
    Pull,
    /// Fetch and send changes
    Sync,
    /// View delta with remote
    Status,
    /// Clear authentication tokens
    Logout,
    /// Generate a new authentication token
    Login {
        name: Option<String>,
    },
    /// The text editor (used in case of conflicts)
    Editor {
        #[command(subcommand)]
        editor: Option<EditorCommands>
    },
    /// The remote repository url
    Remote {
        #[command(subcommand)]
        remote: Option<RemoteCommands>
    },
}

#[derive(Subcommand, Debug)]
pub enum EditorCommands {
    Set {
        url: String,
    }
}

#[derive(Subcommand, Debug)]
pub enum RemoteCommands {
    Set {
        url: String
    }
}