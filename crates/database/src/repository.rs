use crate::item::Trash::Both;
use crate::subscription::Subscription;
use crate::{Database};
use types::enc_string::EncString;
use crate::{query_fmt, query_object, query_objects};
use anyhow::Error;
use postgres_from_row::FromRow;
use serde::{Serialize};
use types::database_ids::{DatabaseIdTrait, RepositoryId, UserId};
use types::repository::Repository;
use crate::item::DbItem;

#[derive(Serialize, Default)]
pub struct RepositoryContributorStats {
    id: UserId,
    count: i64,
}
#[derive(Serialize, Default)]
pub struct RepositoryExtensionStats {
    mimetype: EncString,
    count: i64,
}
#[derive(Serialize, Default)]
pub struct RepositoryStats {
    trash_items: usize,
    trash_directories: usize,
    trash_size: usize,
    items: usize,
    directories: usize,
    size: usize,
    contributors: Vec<RepositoryContributorStats>,
    extensions: Vec<RepositoryExtensionStats>,
}

pub struct DbRepository;

impl DbRepository {
    pub async fn from_id(db: &Database, id: &RepositoryId) -> Result<Repository, Error> {
        match query_object!(db, Repository, "SELECT * FROM SCHEMA_NAME.repository WHERE id = $1", id) {
            None => { Err(Error::msg("Repository not found")) }
            Some(user) => { Ok(user) }
        }
    }
    pub async fn from_user(db: &Database, user: &UserId) -> Result<Vec<Repository>, Error> {
        Ok(query_objects!(db, Repository, "SELECT * FROM SCHEMA_NAME.repository WHERE owner = $1", user))
    }
    pub async fn shared_with(db: &Database, user: &UserId) -> Result<Vec<Repository>, Error> {
        Ok(query_objects!(db, Repository, "SELECT * FROM SCHEMA_NAME.repository WHERE id IN (SELECT repository FROM SCHEMA_NAME.subscriptions WHERE owner = $1);", user))
    }
    pub async fn from_url_name(db: &Database, name: &EncString) -> Result<Repository, Error> {
        match query_object!(db, Repository, "SELECT * FROM SCHEMA_NAME.repository WHERE lower(url_name) = lower($1)", name) {
            None => { Err(Error::msg("Repository not found")) }
            Some(repository) => { Ok(repository) }
        }
    }
    pub async fn public(db: &Database) -> Result<Vec<Repository>, Error> {
        Ok(query_objects!(db, Repository, "SELECT * FROM SCHEMA_NAME.repository WHERE status = 'public'"))
    }

    pub async fn push(repository: &mut Repository, db: &Database) -> Result<(), Error> {
        if repository.url_name.is_empty() {
            return Err(Error::msg("Invalid name"));
        }
        if repository.id().is_valid() {
            query_fmt!(db, "INSERT INTO SCHEMA_NAME.repository
                        (id, url_name, owner, description, status, display_name, max_file_size, visitor_file_lifetime, allow_visitor_upload) VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT(id) DO UPDATE SET
                        id = $1, url_name = $2, owner = $3, description = $4, status = $5, display_name = $6, max_file_size = $7, visitor_file_lifetime = $8, allow_visitor_upload = $9;",
                repository.id(), repository.url_name, repository.owner, repository.description, repository.status, repository.display_name, repository.max_file_size, repository.visitor_file_lifetime, repository.allow_visitor_upload);
        } else {
            let res = query_object!(db, RepositoryId, "INSERT INTO SCHEMA_NAME.repository
                        (url_name, owner, description, status, display_name, max_file_size, visitor_file_lifetime, allow_visitor_upload) VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
                repository.url_name, repository.owner, repository.description, repository.status, repository.display_name, repository.max_file_size, repository.visitor_file_lifetime, repository.allow_visitor_upload);
            if let Some(res) = res {
                repository.set_id(res)?;
            }
        }
        Ok(())
    }

    pub async fn delete(repository: &Repository, db: &Database) -> Result<(), Error> {
        for item in DbItem::from_repository(db, &repository.id(), Both).await? {
            DbItem::delete(&item, db).await?;
        }
        for subscriptions in Subscription::from_repository(db, &repository.id()).await? {
            subscriptions.delete(db).await?
        }
        query_fmt!(db, r#"DELETE FROM SCHEMA_NAME.repository WHERE id = $1;"#, repository.id());
        Ok(())
    }

    pub async fn stats(repository: &Repository, db: &Database) -> Result<RepositoryStats, Error> {
        let mut stats = RepositoryStats::default();
        if let Some(files) = query_fmt!(db, "SELECT COUNT(id) AS num, CAST(COALESCE(SUM(size), 0) AS BIGINT) AS size FROM SCHEMA_NAME.files WHERE id IN (SELECT id FROM SCHEMA_NAME.items WHERE repository = $1 AND NOT in_trash)", repository.id()).pop() {
            stats.items = files.try_get::<&str, i64>("num")? as usize;
            stats.size = files.try_get::<&str, i64>("size")? as usize;
        }
        if let Some(files) = query_fmt!(db, "SELECT COUNT(id) AS num FROM SCHEMA_NAME.items WHERE NOT is_regular_file AND id IN (SELECT id FROM SCHEMA_NAME.items WHERE repository = $1 AND NOT in_trash)", repository.id()).pop() {
            stats.directories = files.try_get::<&str, i64>("num")? as usize;
        }
        if let Some(files) = query_fmt!(db, "SELECT COUNT(id) AS num, CAST(COALESCE(SUM(size), 0) AS BIGINT) AS size FROM SCHEMA_NAME.files WHERE id IN (SELECT id FROM SCHEMA_NAME.items WHERE repository = $1 AND in_trash)", repository.id()).pop() {
            stats.trash_items = files.try_get::<&str, i64>("num")? as usize;
            stats.trash_size = files.try_get::<&str, i64>("size")? as usize;
        }
        if let Some(files) = query_fmt!(db, "SELECT COUNT(id) AS num FROM SCHEMA_NAME.items WHERE NOT is_regular_file AND id IN (SELECT id FROM SCHEMA_NAME.items WHERE repository = $1 AND in_trash)", repository.id()).pop() {
            stats.trash_directories = files.try_get::<&str, i64>("num")? as usize;
        }
        for extension in query_fmt!(db, "SELECT mimetype, COUNT(id) AS num FROM SCHEMA_NAME.files WHERE id IN (SELECT id FROM SCHEMA_NAME.items WHERE repository = $1) GROUP BY mimetype ORDER BY num DESC", repository.id()) {
            stats.extensions.push(RepositoryExtensionStats {
                mimetype: extension.try_get::<&str, EncString, >("mimetype")?,
                count: extension.try_get::<&str, i64, >("num")?,
            });
        }
        for user in query_fmt!(db, "SELECT owner, COUNT(id) AS num FROM SCHEMA_NAME.items WHERE repository = $1 GROUP BY owner ORDER BY num DESC", repository.id()) {
            stats.contributors.push(RepositoryContributorStats {
                id: user.try_get::<&str, UserId, >("owner")?,
                count: user.try_get::<&str, i64, >("num")?,
            });
        }
        Ok(stats)
    }
}