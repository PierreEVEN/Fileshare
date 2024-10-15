use crate::Database;
use crate::{query_fmt, query_object, query_objects};
use anyhow::Error;
use postgres_from_row::FromRow;
use postgres_types::private::BytesMut;
use postgres_types::{to_sql_checked, IsNull, Type};
use serde::{Deserialize, Serialize};
use types::database_ids::{RepositoryId, UserId};

#[derive(Clone, Debug, Default, PartialEq, PartialOrd, Deserialize, Serialize)]
pub enum SubscriptionAccessType {
    #[default]
    ReadOnly,
    Contributor,
    Moderator,
}

impl From<String> for SubscriptionAccessType {
    fn from(value: String) -> Self {
        match value.as_str() {
            "read-only" => { SubscriptionAccessType::ReadOnly }
            "contributor" => { SubscriptionAccessType::Contributor }
            "moderator" => { SubscriptionAccessType::Moderator }
            _ => { SubscriptionAccessType::ReadOnly }
        }
    }
}

impl<'a> postgres_types::FromSql<'a> for SubscriptionAccessType {
    fn from_sql(ty: &Type, raw: &'a [u8]) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> { Ok(Self::from(String::from_sql(ty, raw)?)) }
    fn accepts(ty: &Type) -> bool { ty.name() == "user_access" }
}
impl postgres_types::ToSql for SubscriptionAccessType {
    fn to_sql(&self, ty: &Type, out: &mut BytesMut) -> Result<IsNull, Box<dyn std::error::Error + Sync + Send>> {
        match self {
            SubscriptionAccessType::ReadOnly => { "read-only".to_sql(ty, out) }
            SubscriptionAccessType::Contributor => { "contributor".to_sql(ty, out) }
            SubscriptionAccessType::Moderator => { "moderator".to_sql(ty, out) }
        }
    }
    fn accepts(ty: &Type) -> bool { ty.name() == "user_access" }
    to_sql_checked!();
}


#[derive(Serialize, Debug, Default, FromRow, Clone)]
pub struct Subscription {
    pub owner: UserId,
    pub repository: RepositoryId,
    pub access_type: SubscriptionAccessType,
}

impl Subscription {
    pub async fn find(db: &Database, id: &UserId, repository: &RepositoryId) -> Result<Self, Error> {
        match query_object!(db, Self, "SELECT * FROM SCHEMA_NAME.subscriptions WHERE owner = $1 AND repository = $2", id, repository) {
            None => { Err(Error::msg("No subscription found")) }
            Some(subscription) => { Ok(subscription) }
        }
    }
    pub async fn from_user(db: &Database, id: &UserId) -> Result<Vec<Self>, Error> {
        Ok(query_objects!(db, Self, "SELECT * FROM SCHEMA_NAME.subscriptions WHERE owner = $1", id))
    }
    pub async fn from_repository(db: &Database, repository: &RepositoryId) -> Result<Vec<Self>, Error> {
        Ok(query_objects!(db, Self, "SELECT * FROM SCHEMA_NAME.subscriptions WHERE repository = $1", repository))
    }

    pub async fn push(&mut self, db: &Database) -> Result<(), Error> {
        query_fmt!(db, "INSERT INTO SCHEMA_NAME.subscriptions
                        (owner, repository, access_type) VALUES
                        ($1, $2, $3);",
                self.owner, self.repository, self.access_type);
        Ok(())
    }

    pub async fn delete(&self, db: &Database) -> Result<(), Error> {
        query_fmt!(db, r#"DELETE FROM SCHEMA_NAME.subscriptions WHERE repository = $1 AND owner = $2;"#, self.repository, self.owner);
        Ok(())
    }
}