use std::{env, fs};
use std::path::{Path, PathBuf};
use anyhow::Error;
use crate::content::connection::Url;

static META_DIR_NAME: &str = ".fileshare";
static TMP_DOWNLOAD_DIR_NAME: &str = "tmp";
static CONNECTION_CONFIG_FILE: &str = "connection.json";
static DATABASE_CONFIG_FILE: &str = "database.json";
static REPOSITORY_CONFIG_FILE: &str = "repository.json";

#[derive(Default, Clone)]
pub struct MetaDir {
    root_dir: Option<PathBuf>,
}

impl MetaDir {
    pub fn new_here() -> Result<Self, Error> {
        if MetaDir::is_a_repository_root(env::current_dir()?.as_path()) {
            return Err(Error::msg("Cannot create repository here : already an existing repository"));
        }
        Ok(Self {
            root_dir: Some(env::current_dir()?),
        })
    }

    pub fn new_create(public_url: &str) -> Result<Self, Error> {
        let current_dir = env::current_dir()?;
        if MetaDir::is_a_repository_root(current_dir.as_path()) {
            return Err(Error::msg("Cannot create repository here : already an existing repository"));
        }
        let (_, _, _, repository) = Url::parse(public_url)?;
        let root = current_dir.join(&repository);
        if root.exists() {
            return Err(Error::msg(format!("Cannot create repository here : the directory '{repository}' already exists")));
        }
        let dirs = Self {
            root_dir: Some(root),
        };
        dirs.create_dirs()?;
        Ok(dirs)
    }

    pub fn search_here() -> Result<Self, Error> {
        Self::search_here_internal(env::current_dir()?.as_path())
    }

    fn search_here_internal(path: &Path) -> Result<Self, Error> {
        if !Self::is_a_repository_root(path) {
            if let Some(parent) = path.parent() {
                Self::search_here_internal(parent)
            } else {
                Err(Error::msg("Not a fileshare repository"))
            }
        } else {
            Ok(Self {
                root_dir: Some(path.to_path_buf()),
            })
        }
    }

    fn create_dirs(&self) -> Result<(), Error> {
        let tmp_dir = self.root()?.join(META_DIR_NAME).join(TMP_DOWNLOAD_DIR_NAME);
        if !tmp_dir.exists() {
            fs::create_dir_all(tmp_dir)?;
        }
        Ok(())
    }

    pub fn connection_config_path(&self) -> Result<PathBuf, Error> {
        self.create_dirs()?;
        Ok(self.root()?.join(META_DIR_NAME).join(CONNECTION_CONFIG_FILE))
    }

    pub fn repository_config_path(&self) -> Result<PathBuf, Error> {
        self.create_dirs()?;
        Ok(self.root()?.join(META_DIR_NAME).join(REPOSITORY_CONFIG_FILE))
    }

    pub fn local_database_path(&self) -> Result<PathBuf, Error> {
        self.create_dirs()?;
        Ok(self.root()?.join(META_DIR_NAME).join(DATABASE_CONFIG_FILE))
    }

    pub fn tmp_download_dir(&self) -> Result<PathBuf, Error> {
        self.create_dirs()?;
        Ok(self.root()?.join(META_DIR_NAME).join(TMP_DOWNLOAD_DIR_NAME))
    }

    pub fn root(&self) -> Result<PathBuf, Error> {
        if let Some(root) = &self.root_dir {
            Ok(root.clone())
        } else {
            Err(Error::msg("Root directory is not set"))
        }
    }


    pub fn is_a_repository_root(path: &Path) -> bool {
        if !path.exists() { return false; }
        let meta_dir = path.join(META_DIR_NAME);
        if !meta_dir.exists() { return false; }
        true
    }
}