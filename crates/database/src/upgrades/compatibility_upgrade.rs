use anyhow::Error;
use tracing::info;
use types::database_ids::ObjectId;
use crate::Database;
use crate::query_fmt;

#[macro_export]
macro_rules! query_upgrade {
    ($db:expr, $old_schema_name:expr, $query:expr) => {{
        $db.db().query(&$query.replace("OLD_SCHEMA_NAME", &$old_schema_name).replace("SCHEMA_NAME", &$db.schema_name), &[]).await?
    }};

    ($db:expr, $old_schema_name:expr, $query:expr, $( $bound_values:expr),*) => {{
        let params: &[&(dyn postgres_types::ToSql + Sync)] = &[$(&$bound_values,)*];
        $db.db().query(&$query.replace("OLD_SCHEMA_NAME", &$old_schema_name).replace("SCHEMA_NAME", &$db.schema_name), params).await?
    }};
}

pub struct Upgrade {}

impl Upgrade {
    pub async fn run(db: &Database, old_schema_name: &String) -> Result<(), Error> {
        Self::clean_local_data(db).await?;
        Self::copy_users(db, old_schema_name).await?;
        Self::copy_repository(db, old_schema_name).await?;
        Self::copy_subscriptions(db, old_schema_name).await?;
        Self::copy_items(db, old_schema_name).await?;
        Ok(())
    }

    async fn clean_local_data(db: &Database) -> Result<(), Error> {
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.files");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.directories");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.items");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.objects");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.subscriptions");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.repository");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.authtoken");
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.users");
        info!("Successfully cleaned database 'user'");
        Ok(())
    }

    async fn copy_users(db: &Database, old_schema_name: &String) -> Result<(), Error> {
        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.users(id, email, name, login, password_hash, allow_contact, user_role)
                    (SELECT id, email, name, name, password_hash, allow_contact, cast(role::TEXT AS SCHEMA_NAME.user_role)
                    FROM OLD_SCHEMA_NAME.users)");
        info!("Successfully upgraded 'user' table");
        Ok(())
    }

    async fn copy_repository(db: &Database, old_schema_name: &String) -> Result<(), Error> {
        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.repository(id, url_name, owner, description, status, display_name, max_file_size, visitor_file_lifetime, allow_visitor_upload)
                    (SELECT id, name, owner, description, cast(status::TEXT AS SCHEMA_NAME.repository_status), display_name, max_file_size, visitor_file_lifetime, allow_visitor_upload
                    FROM OLD_SCHEMA_NAME.repos)");
        let min_object = query_upgrade!(db, old_schema_name, "SELECT max(id) AS id FROM OLD_SCHEMA_NAME.repos;");
        let min_object = min_object[0].try_get::<&str, ObjectId>("id")?;
        query_fmt!(db, format!("ALTER SEQUENCE SCHEMA_NAME.repository_id_seq RESTART WITH {min_object}"));
        info!("Successfully upgraded 'repository' table");
        Ok(())
    }

    async fn copy_subscriptions(db: &Database, old_schema_name: &String) -> Result<(), Error> {
        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.subscriptions(owner, repository, access_type)
                    (SELECT owner, repos, cast(access_type::TEXT AS SCHEMA_NAME.user_access)
                    FROM OLD_SCHEMA_NAME.userrepos)");
        info!("Successfully upgraded 'subscriptions' table");
        Ok(())
    }

    async fn copy_items(db: &Database, old_schema_name: &String) -> Result<(), Error> {
        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.items(id, repository, owner, name, is_regular_file, description, parent_item, absolute_path, in_trash)
                    (SELECT id, repos, owner, name, is_regular_file, description, parent_item, absolute_path, in_trash
                    FROM OLD_SCHEMA_NAME.items)");
        let min_object = query_upgrade!(db, old_schema_name, "SELECT max(id) AS id FROM OLD_SCHEMA_NAME.items;");
        let min_object = min_object[0].try_get::<&str, ObjectId>("id")?;
        query_fmt!(db, format!("ALTER SEQUENCE SCHEMA_NAME.items_id_seq RESTART WITH {min_object}"));

        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.objects(id, hash)
                    (SELECT id, hash
                    FROM OLD_SCHEMA_NAME.file_data)");

        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.files(id, size, mimetype, timestamp, object)
                    (SELECT id, size, mimetype, timestamp, id
                    FROM OLD_SCHEMA_NAME.file_data)");
        let min_object = query_upgrade!(db, old_schema_name, "SELECT max(id) AS id FROM OLD_SCHEMA_NAME.file_data;");
        let min_object = min_object[0].try_get::<&str, ObjectId>("id")?;
        query_fmt!(db, format!("ALTER SEQUENCE SCHEMA_NAME.objects_id_seq RESTART WITH {min_object}"));

        query_upgrade!(db, old_schema_name, "INSERT INTO
                    SCHEMA_NAME.directories(id, open_upload)
                    (SELECT id, open_upload
                    FROM OLD_SCHEMA_NAME.directory_data)");
        
        info!("Successfully upgraded 'items' table");
        Ok(())
    }
}