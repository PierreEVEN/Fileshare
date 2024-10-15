use crate::content::filesystem::Filesystem;
use crate::content::item::Item;
use crate::repository::Repository;
use anyhow::Error;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Default)]
pub struct Diff {
    actions: Vec<Action>,
}

fn sort_items_to_set(items: &Vec<Arc<RwLock<dyn Item>>>) -> HashMap<String, Arc<RwLock<dyn Item>>> {
    let mut hashmap = HashMap::new();
    for item in items {
        hashmap.insert(item.read().unwrap().name().plain().unwrap(), item.clone());
    }
    hashmap
}

#[derive(Debug, Clone)]
pub enum Action {
    ///scanned : up to date but local reference needs to be updated (#resync local)
    ResyncLocal(Arc<RwLock<dyn Item>>),
    ///scanned - remote : CONFLICT : Local item was added on both side, but local is newer
    ConflictAddLocalNewer(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - remote : ERROR : Remote downgraded. Is it normal ?
    ErrorRemoteDowngraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - remote : Scanned upgraded (#upload)
    LocalUpgraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - local - remote : CONFLICT : Both downgraded
    ConflictBothDowngraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - local - remote : CONFLICT : Both upgraded
    ConflictBothUpgraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - local - remote : Local upgraded / remote downgraded
    ConflictLocalUpgradedRemoteDowngraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - remote : CONFLICT : Local item was added on both side, but remote is newer
    ConflictAddRemoteNewer(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - remote : Remote upgraded (#download)
    RemoteUpgraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - remote : ERROR : Local downgraded. Is it normal ?
    ErrorLocalDowngraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned - local - remote : CONFLICT : Local downgraded / remote upgraded
    ConflictLocalDowngradedRemoteUpgraded(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///scanned : was removed on remote (#local-delete)
    RemoteRemoved(Arc<RwLock<dyn Item>>),
    ///scanned : was added on local filesystem (#upload)
    LocalAdded(Arc<RwLock<dyn Item>>),
    ///local, remote : was removed on local filesystem (#remote-delete)
    LocalRemoved(Arc<RwLock<dyn Item>>, Arc<RwLock<dyn Item>>),
    ///remote : was added on remote (#download)
    RemoteAdded(Arc<RwLock<dyn Item>>),
    ///local : was removed on both side (#resync delete-ref)
    RemovedOnBothSides(Arc<RwLock<dyn Item>>),
}

impl Diff {
    pub async fn from_repository(repository: &mut Repository) -> Result<Self, Error> {
        Diff::new(&*repository.scan_local_content()?.read().unwrap(),
                  &*repository.fetch_local_content()?.read().unwrap(),
                  &*repository.fetch_remote_content().await?.read().unwrap())
    }

    pub fn new(scanned: &dyn Filesystem, local: &dyn Filesystem, remote: &dyn Filesystem) -> Result<Self, Error> {
        let mut diff = Self::default();
        diff.compare(sort_items_to_set(&scanned.get_roots()?),
                     sort_items_to_set(&local.get_roots()?),
                     sort_items_to_set(&remote.get_roots()?))?;
        Ok(diff)
    }

    pub fn actions(&self) -> &Vec<Action> {
        &self.actions
    }

    fn compare(&mut self, scanned: HashMap<String, Arc<RwLock<dyn Item>>>, local: HashMap<String, Arc<RwLock<dyn Item>>>, remote: HashMap<String, Arc<RwLock<dyn Item>>>) -> Result<(), Error> {
        for (key, scanned_item_ref) in &scanned {
            if let Some(remote_item_ref) = remote.get(key) {
                // The object exists on local scanned filesystem and remote

                let scanned_item = scanned_item_ref.read().unwrap();
                let remote_item = remote_item_ref.read().unwrap();

                if !scanned_item.is_regular_file() || scanned_item.timestamp() == remote_item.timestamp() {
                    match local.get(key) {
                        None => {
                            // item up to date but local reference needs to be updated (#resync local)
                            self.actions.push(Action::ResyncLocal(scanned_item_ref.clone()));
                        }
                        Some(_local_item_ref) => {
                            // Nothing to do. Keep scanning inside
                        }
                    }
                } else if scanned_item.timestamp() > remote_item.timestamp() {
                    match local.get(key) {
                        None => {
                            // CONFLICT : Local item was added on both side, but local is newer
                            self.actions.push(Action::ConflictAddLocalNewer(scanned_item_ref.clone(), remote_item_ref.clone()));
                        }
                        Some(local_item_ref) => {
                            let local_item = local_item_ref.read().unwrap();
                            if scanned_item.timestamp() == local_item.timestamp() {
                                // ERROR : Remote downgraded. Is it normal ?
                                self.actions.push(Action::ErrorRemoteDowngraded(scanned_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() == remote_item.timestamp() {
                                // Scanned upgraded (#upload)
                                self.actions.push(Action::LocalUpgraded(scanned_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() > scanned_item.timestamp() {
                                // CONFLICT : Both downgraded
                                self.actions.push(Action::ConflictBothDowngraded(scanned_item_ref.clone(), local_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() < remote_item.timestamp() {
                                // CONFLICT : Both upgraded
                                self.actions.push(Action::ConflictBothUpgraded(scanned_item_ref.clone(), local_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() > remote_item.timestamp() {
                                // CONFLICT : Local upgraded / remote downgraded
                                self.actions.push(Action::ConflictLocalUpgradedRemoteDowngraded(scanned_item_ref.clone(), local_item_ref.clone(), remote_item_ref.clone()));
                            } else {
                                panic!("unhandled case");
                            }
                        }
                    }
                } else if scanned_item.timestamp() < remote_item.timestamp() {
                    match local.get(key) {
                        None => {
                            // CONFLICT : Local item was added on both side, but remote is newer
                            self.actions.push(Action::ConflictAddRemoteNewer(scanned_item_ref.clone(), remote_item_ref.clone()));
                        }
                        Some(local_item_ref) => {
                            let local_item = local_item_ref.read().unwrap();
                            if scanned_item.timestamp() == local_item.timestamp() {
                                // Remote upgraded (#download)
                                self.actions.push(Action::RemoteUpgraded(scanned_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() == remote_item.timestamp() {
                                // ERROR : Local downgraded. Is it normal ?
                                self.actions.push(Action::ErrorLocalDowngraded(scanned_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() < scanned_item.timestamp() {
                                // CONFLICT : Both upgraded
                                self.actions.push(Action::ConflictBothUpgraded(scanned_item_ref.clone(), local_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() > remote_item.timestamp() {
                                // CONFLICT : Both downgraded
                                self.actions.push(Action::ConflictBothDowngraded(scanned_item_ref.clone(), local_item_ref.clone(), remote_item_ref.clone()));
                            } else if local_item.timestamp() < remote_item.timestamp() {
                                // CONFLICT : Local downgraded / remote upgraded
                                self.actions.push(Action::ConflictLocalDowngradedRemoteUpgraded(scanned_item_ref.clone(), local_item_ref.clone(), remote_item_ref.clone()));
                            } else {
                                panic!("unhandled case");
                            }
                        }
                    }
                }
            } else {
                // The item exists on local scanned filesystem but not on remote
                if local.contains_key(key) {
                    // was removed on remote (#local-delete)
                    self.actions.push(Action::RemoteRemoved(scanned_item_ref.clone()));
                } else {
                    // was added on local filesystem (#upload)
                    self.actions.push(Action::LocalAdded(scanned_item_ref.clone()));
                }
            }
        }

        for (key, remote_item_ref) in &remote {
            if !scanned.contains_key(key) {
                // The item exists on remote but not on local scanned filesystem
                if let Some(local_ref) = local.get(key) {
                    // was removed on local filesystem (#remote-delete)
                    self.actions.push(Action::LocalRemoved(local_ref.clone(), remote_item_ref.clone()));
                } else {
                    // was added on remote (#download)
                    self.actions.push(Action::RemoteAdded(remote_item_ref.clone()));
                }
            }
        }

        for (key, local_item_ref) in &local {
            if !scanned.contains_key(key) && !remote.contains_key(key) {
                // was removed on both side (#resync delete-ref)
                self.actions.push(Action::RemovedOnBothSides(local_item_ref.clone()));
            }
        }

        for (key, scanned_item_ref) in &scanned {
            if let Some(remote_item_ref) = remote.get(key) {
                if let Some(local_item_ref) = local.get(key) {
                    self.compare(
                        sort_items_to_set(&scanned_item_ref.read().unwrap().get_children()?),
                        sort_items_to_set(&local_item_ref.read().unwrap().get_children()?),
                        sort_items_to_set(&remote_item_ref.read().unwrap().get_children()?))?
                }
            }
        }

        Ok(())
    }
}