use crate::content::diff::{Action, Diff};
use crate::repository::Repository;
use anyhow::Error;
use crate::content::meta_dir::MetaDir;

pub struct ActionPull {}

impl ActionPull {
    pub async fn run() -> Result<Repository, Error> {
        let mut repos = Repository::new(MetaDir::search_here()?)?;
        let diff = Diff::from_repository(&mut repos).await?;

        let mut actions = vec![];
        for action in diff.actions() {
            match action {
                Action::ResyncLocal(_) => { actions.push(action.clone()); }
                Action::ConflictAddLocalNewer(_, _) => {}
                Action::ErrorRemoteDowngraded(_, _) => { actions.push(action.clone()) }
                Action::LocalUpgraded(_, _) => {}
                Action::ConflictBothDowngraded(_, _, _) => { actions.push(action.clone()) }
                Action::ConflictBothUpgraded(_, _, _) => { actions.push(action.clone()) }
                Action::ConflictLocalUpgradedRemoteDowngraded(_, _, _) => { actions.push(action.clone()) }
                Action::ConflictAddRemoteNewer(_, _) => { actions.push(action.clone()) }
                Action::RemoteUpgraded(_, _) => { actions.push(action.clone()) }
                Action::ErrorLocalDowngraded(_, _) => {}
                Action::ConflictLocalDowngradedRemoteUpgraded(_, _, _) => { actions.push(action.clone()) }
                Action::RemoteRemoved(_) => { actions.push(action.clone()) }
                Action::LocalAdded(_) => {}
                Action::LocalRemoved(_, _) => {}
                Action::RemoteAdded(_) => { actions.push(action.clone()) }
                Action::RemovedOnBothSides(_) => { actions.push(action.clone()); }
            }
        }

        repos.apply_actions(&actions).await?;

        Ok(repos)
    }
}