use crate::repository::DbRepository;
use crate::subscription::Subscription;
use crate::{query_fmt, query_object, query_objects};
use crate::Database;
use anyhow::Error;
use rand::distributions::{Alphanumeric, DistString};
use rand::random;
use std::time::{SystemTime, UNIX_EPOCH};
use types::database_ids::{DatabaseId, DatabaseIdTrait, PasswordHash, UserId};
use types::enc_string::EncString;
use types::user::{AuthToken, User};
use postgres_from_row::FromRow;

pub struct DbAuthToken;

impl DbAuthToken {
    pub async fn find(db: &Database, token: &EncString) -> Result<AuthToken, Error> {
        query_object!(db, AuthToken, "SELECT * FROM SCHEMA_NAME.authtoken WHERE token = $1", token).ok_or(Error::msg("Invalid authentication token"))
    }

    pub async fn from_user(db: &Database, id: &UserId) -> Result<Vec<AuthToken>, Error> {
        Ok(query_objects!(db, AuthToken, "SELECT * FROM SCHEMA_NAME.authtoken WHERE owner = $1", id))
    }

    pub async fn delete(token: &AuthToken, db: &Database) -> Result<(), Error> {
        query_fmt!(db, "DELETE FROM SCHEMA_NAME.authtoken WHERE token = $1", token.token);
        Ok(())
    }
}

pub struct DbUser;

impl DbUser {
    pub async fn from_id(db: &Database, id: &UserId) -> Result<User, Error> {
        match query_object!(db, User, "SELECT * FROM SCHEMA_NAME.users WHERE id = $1", id) {
            None => { Err(Error::msg("User not found")) }
            Some(user) => { Ok(user) }
        }
    }

    pub async fn from_url_name(db: &Database, name: &EncString) -> Result<User, Error> {
        match query_object!(db, User, "SELECT * FROM SCHEMA_NAME.users WHERE LOWER(name) = LOWER($1)", name) {
            None => { Err(Error::msg("User not found")) }
            Some(user) => { Ok(user) }
        }
    }

    pub async fn search(db: &Database, name: &EncString, exact: bool) -> Result<Vec<User>, Error> {
        if exact {
            match query_object!(db, User, "SELECT * FROM SCHEMA_NAME.users WHERE LOWER(name) = LOWER($1)", name) {
                None => { Err(Error::msg("User not found")) }
                Some(user) => { Ok(vec![user]) }
            }
        } else {
            Ok(query_objects!(db, User, "SELECT * FROM SCHEMA_NAME.users WHERE LOWER(name) LIKE '%' || LOWER($1) || '%'", name))
        }
    }

    pub async fn exists(db: &Database, login: &EncString, email: &EncString) -> Result<bool, Error> {
        Ok(!query_objects!(db, User, r#"SELECT * FROM SCHEMA_NAME.users WHERE login = $1 OR email = $2"#, login, email).is_empty())
    }

    pub async fn has_admin(db: &Database) -> Result<bool, Error> {
        let admins = query_objects!(db, User, "SELECT * FROM SCHEMA_NAME.users WHERE user_role = 'admin'");
        if admins.is_empty() {
            Ok(false)
        } else {
            Ok(true)
        }
    }

    pub async fn from_credentials(db: &Database, login: &EncString, password: &EncString) -> Result<User, Error> {
        let user = query_object!(db, User, r#"SELECT * FROM SCHEMA_NAME.users WHERE login = $1 OR email = $1"#, login.encoded()).ok_or(Error::msg("User not found"))?;
        if user.password().verify(password)? {
            Ok(user)
        } else {
            Err(Error::msg("Failed to find user with given credentials"))
        }
    }

    pub async fn from_auth_token(db: &Database, authtoken: &EncString) -> Result<User, Error> {
        DbUser::from_id(db, DbAuthToken::find(db, authtoken).await?.owner()).await
    }

    pub async fn generate_auth_token(user: &User, db: &Database, device: &EncString) -> Result<AuthToken, Error> {
        let mut token: String;
        loop {
            token = Alphanumeric.sample_string(&mut rand::thread_rng(), 64);
            if query_fmt!(db, "SELECT token FROM SCHEMA_NAME.authtoken WHERE token = $1", token).is_empty() {
                break;
            }
        }
        let enc_token = EncString::encode(token.as_str());

        let exp_date = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;

        query_fmt!(db, "INSERT INTO SCHEMA_NAME.authtoken (owner, token, device, expdate) VALUES ($1, $2, $3, $4)", user.id(), enc_token, device, exp_date);
        query_object!(db, AuthToken, "SELECT * from SCHEMA_NAME.authtoken WHERE token = $1", enc_token).ok_or(Error::msg("Failed to add authentication token"))
    }

    pub async fn create_or_reset_password(user: &mut User, db: &Database, password_hash: &PasswordHash) -> Result<(), Error> {
        if !user.id().is_valid() {
            loop {
                user.set_id(UserId::from(random::<DatabaseId>().abs()))?;
                if query_fmt!(db, "SELECT id FROM SCHEMA_NAME.users WHERE id = $1", *user.id()).is_empty() {
                    break;
                }
            }
        }
        user.update_password(password_hash.clone());
        Self::push(user, db).await
    }

    pub async fn push(user: &mut User, db: &Database) -> Result<(), Error> {
        if user.name.is_empty() {
            return Err(Error::msg("Invalid name"));
        }
        query_fmt!(db, "INSERT INTO SCHEMA_NAME.users
                        (id, email, password_hash, name, allow_contact, user_role, login) VALUES
                        ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT(id) DO UPDATE SET
                        id = $1, email = $2, password_hash = $3, name = LOWER($4), allow_contact = $5, user_role = $6, login = $7;",
            user.id(), user.email, user.password(), user.name, user.allow_contact, user.user_role, user.login);
        Ok(())
    }

    pub async fn delete(user: &User, db: &Database) -> Result<(), Error> {
        for repository in DbRepository::from_user(db, &user.id()).await? {
            DbRepository::delete(&repository, db).await?;
        }
        for token in DbAuthToken::from_user(db, user.id()).await? {
            DbAuthToken::delete(&token, db).await?;
        }
        for subscriptions in Subscription::from_user(db, &user.id()).await? {
            subscriptions.delete(db).await?
        }
        query_fmt!(db, r#"DELETE FROM SCHEMA_NAME.users WHERE id = $1;"#, user.id());
        Ok(())
    }
}