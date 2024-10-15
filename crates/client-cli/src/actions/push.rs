use crate::content::diff::{Action, Diff};
use crate::repository::Repository;
use anyhow::Error;
use crate::content::meta_dir::MetaDir;

pub struct ActionPush {}

impl ActionPush {
    pub async fn run() -> Result<Repository, Error> {
        let mut repos = Repository::new(MetaDir::search_here()?)?;
        let diff = Diff::from_repository(&mut repos).await?;

        let mut actions = vec![];
        for action in diff.actions() {
            match action {
                Action::ResyncLocal(_) => { actions.push(action.clone()); }
                Action::ConflictAddLocalNewer(_, _) => { actions.push(action.clone()); }
                Action::ErrorRemoteDowngraded(_, _) => {}
                Action::LocalUpgraded(_, _) => { actions.push(action.clone()); }
                Action::ConflictBothDowngraded(_, _, _) => { actions.push(action.clone()) }
                Action::ConflictBothUpgraded(_, _, _) => { actions.push(action.clone()) }
                Action::ConflictLocalUpgradedRemoteDowngraded(_, _, _) => { actions.push(action.clone()) }
                Action::ConflictAddRemoteNewer(_, _) => { actions.push(action.clone()) }
                Action::RemoteUpgraded(_, _) => {}
                Action::ErrorLocalDowngraded(_, _) => { actions.push(action.clone()); }
                Action::ConflictLocalDowngradedRemoteUpgraded(_, _, _) => { actions.push(action.clone()) }
                Action::RemoteRemoved(_) => {}
                Action::LocalAdded(_) => { actions.push(action.clone()); }
                Action::LocalRemoved(_, _) => { actions.push(action.clone()); }
                Action::RemoteAdded(_) => {}
                Action::RemovedOnBothSides(_) => { actions.push(action.clone()); }
            }
        }

        repos.apply_actions(&actions).await?;

        Ok(repos)
    }
}