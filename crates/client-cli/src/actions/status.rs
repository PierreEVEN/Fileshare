use crate::content::diff::{Action, Diff};
use crate::repository::Repository;
use anyhow::Error;
use paris::{success};
use crate::content::meta_dir::MetaDir;

pub struct ActionStatus {}

impl ActionStatus {
    pub async fn run() -> Result<Repository, Error> {
        let mut repos = Repository::new(MetaDir::search_here()?)?;
        let diff = Diff::from_repository(&mut repos).await?;

        if diff.actions().is_empty() {
            success!("Nothing to do !");
            return Ok(repos);
        }

        println!(" 🖥️💾☁️| [Local file - Saved sate - Remote file]");
        let mut actions = vec![];
        for action in diff.actions() {
            match action {
                Action::ResyncLocal(scanned, _) => {
                    let scanned = scanned.read().unwrap();
                    actions.push(action.clone());
                    println!(" ⚊ . ⚊ | {} - The file exists on both side but was not tracked.", scanned.path_from_root()?.display());
                }
                Action::ConflictAddLocalNewer(scanned, remote) => {
                    let scanned = scanned.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!("+ . + | {} - ✅ CONFLICT ✅ : The file was added on both sides. (🖥️ {} ▶️ {} ☁️)", scanned.path_from_root()?.display(), scanned.timestamp()?, remote.timestamp()?);
                }
                Action::ErrorRemoteDowngraded(scanned, remote) => {
                    let scanned = scanned.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⚊ ⚊ ⩢ | {} - ⬇️ Remote file was reverted to an older version. (🖥️{} ▶️ ☁️{} )", scanned.path_from_root()?.display(), scanned.timestamp()?, remote.timestamp()?);
                }
                Action::LocalUpgraded(scanned, remote) => {
                    let scanned = scanned.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⩠ ⚊ ⚊ | {} - ⬇️ The file was updated locally. (🖥️{} ▶️ ☁️{} )", scanned.path_from_root()?.display(), scanned.timestamp()?, remote.timestamp()?);
                }
                Action::ConflictBothDowngraded(scanned, local, remote) => {
                    let scanned = scanned.read().unwrap();
                    let local = local.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⩢ ⚊ ⩢ | {} - ⬇️ File have been downgraded on both side. (🖥️{} ▶️ 💾{} ▶️ ☁️{})", scanned.path_from_root()?.display(), scanned.timestamp()?, local.timestamp()?, remote.timestamp()?);
                }
                Action::ConflictBothUpgraded(scanned, local, remote) => {
                    let scanned = scanned.read().unwrap();
                    let local = local.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⩠ ⚊ ⩠ | {} - ⬇️ File have been upgraded on both side. (🖥️{} ▶️ 💾{} ◀️ ☁️{})", scanned.path_from_root()?.display(), scanned.timestamp()?, local.timestamp()?, remote.timestamp()?);
                }
                Action::ConflictLocalUpgradedRemoteDowngraded(scanned, local, remote) => {
                    let scanned = scanned.read().unwrap();
                    let local = local.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⩠ ⚊ ⩢ | {} - ❔ Remote was reverted and local one was updated. (🖥️{} ▶️ ️💾{} ▶️ ☁️{} )", scanned.path_from_root()?.display(), scanned.timestamp()?, local.timestamp()?, remote.timestamp()?);
                }
                Action::ConflictAddRemoteNewer(scanned, remote) => {
                    let scanned = scanned.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" + . + | {} - ✅ CONFLICT ✅ : The file was added on both sides. (🖥️{} ◀️ ☁️{})", scanned.path_from_root()?.display(), scanned.timestamp()?, remote.timestamp()?);
                }
                Action::RemoteUpgraded(scanned, remote) => {
                    let scanned = scanned.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⚊ ⚊ ⩠ | {} - The file was upgraded on remote. (🖥️ {} ◀️ ☁️{} )", scanned.path_from_root()?.display(), scanned.timestamp()?, remote.timestamp()?);
                }
                Action::ErrorLocalDowngraded(scanned, remote) => {
                    let scanned = scanned.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⩢ ⚊ ⚊ | {} - The file was reverted locally. (🖥️{} ▶️ ☁️{} )", scanned.path_from_root()?.display(), scanned.timestamp()?, remote.timestamp()?);
                }
                Action::ConflictLocalDowngradedRemoteUpgraded(scanned, local, remote) => {
                    let scanned = scanned.read().unwrap();
                    let local = local.read().unwrap();
                    let remote = remote.read().unwrap();
                    println!(" ⩢ ⚊ ⩠ | {} - ❔ Local was reverted and remote one was updated. (🖥️{} ◀️ ️💾{} ◀️ ☁️{} )", scanned.path_from_root()?.display(), scanned.timestamp()?, local.timestamp()?, remote.timestamp()?);
                }
                Action::RemoteRemoved(scanned) => {
                    let scanned = scanned.read().unwrap();
                    println!(" ⚊ ⚊ X | {} - ✖️ The file have been deleted on remote.", scanned.path_from_root()?.display());
                }
                Action::LocalAdded(scanned) => {
                    let scanned = scanned.read().unwrap();
                    println!(" + . . | {} - ➕ This file has been added locally.", scanned.path_from_root()?.display());
                }
                Action::LocalRemoved(_, remote) => {
                    let remote = remote.read().unwrap();
                    println!(" X ⚊ ⚊ | {} - ✖️ The file have been deleted locally.", remote.path_from_root()?.display());
                }
                Action::RemoteAdded(remote) => {
                    let remote = remote.read().unwrap();
                    println!(" . . + | {} - ➕ This file was added on remote.", remote.path_from_root()?.display());
                }
                Action::RemovedOnBothSides(local) => {
                    let local = local.read().unwrap();
                    actions.push(action.clone());
                    println!(" X ⚊ X | {} - ➕ This file was removed on both sides.", local.path_from_root()?.display());
                }
            }
        }

        if !actions.is_empty() {
            repos.apply_actions(&actions).await?;
        }

        Ok(repos)
    }
}