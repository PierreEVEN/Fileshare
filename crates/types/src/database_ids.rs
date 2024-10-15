#[macro_export]
macro_rules! make_wrapped_db_type {
    ($T:ident, $Inside:ty $(,$traits:ty)*) => {
        #[derive($($traits,)*)]
        pub struct $T($Inside);

        #[cfg(feature = "tokio-postgres")]
        impl postgres_types::ToSql for $T {
            fn to_sql(&self, ty: &postgres_types::Type, out: &mut postgres_types::private::BytesMut) -> Result<postgres_types::IsNull, Box<dyn std::error::Error + Sync + Send>> { self.0.to_sql(ty, out) }
            fn accepts(ty: &postgres_types::Type) -> bool { <$Inside>::accepts(ty) }
            postgres_types::to_sql_checked!();
        }

        #[cfg(feature = "tokio-postgres")]
        impl<'a> postgres_types::FromSql<'a> for $T {
            fn from_sql(ty: &postgres_types::Type, raw: &'a [u8]) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> { Ok(Self(<$Inside>::from_sql(ty, raw)?)) }
            fn accepts(ty: &postgres_types::Type) -> bool { <$Inside>::accepts(ty) }
        }
    };
}

#[macro_export]
macro_rules! make_database_id {
    ($T:ident) => {
        crate::make_wrapped_db_type!($T, DatabaseId, Default, std::fmt::Debug, Clone);

        impl std::ops::Deref for $T {
            type Target = DatabaseId;
            fn deref(&self) -> &Self::Target {
                &self.0
            }
        }
        impl PartialEq<Self> for $T {
            fn eq(&self, other: &Self) -> bool {
                self.0 == other.0
            }
        }
        impl Eq for $T {}

        impl std::hash::Hash for $T {
            fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
                self.0.hash(state)
            }
        }

        #[cfg(feature = "tokio-postgres")]
        impl postgres_from_row::FromRow for $T {
            fn from_row(row: &tokio_postgres::Row) -> Self {
                Self(row.get::<&str, DatabaseId>("id"))
            }

            fn try_from_row(row: &tokio_postgres::Row) -> Result<Self, tokio_postgres::Error> {
                Ok(Self(row.try_get::<&str, DatabaseId>("id")?))
            }
        }

        impl From<DatabaseId> for $T {
            fn from(value: DatabaseId) -> Self {
                Self(value)
            }
        }
        impl std::fmt::Display for $T {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                <DatabaseId as std::fmt::Display>::fmt(&self.0, f)
            }
        }

        impl<'de> serde::Deserialize<'de> for $T {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<$T, D::Error> {
                struct DbIdVisitor;
                impl<'de> serde::de::Visitor<'de> for DbIdVisitor {
                    type Value = $T;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                        formatter.write_str("int64 id in string format")
                    }

                    fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<$T, E> {
                        use std::str::FromStr;
                        Ok($T(match DatabaseId::from_str(value) {
                            Ok(id) => { id }
                            Err(err) => { return Err(serde::de::Error::custom(format!("Failed to parse id : {}", err))) }
                        }))
                    }
                }
                deserializer.deserialize_string(DbIdVisitor)
            }
        }


        impl serde::Serialize for $T {
            fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                serializer.serialize_str(self.0.to_string().as_str())
            }
        }
    };
}


pub type DatabaseId = i64;
pub trait DatabaseIdTrait {
    fn is_valid(&self) -> bool;
}
impl DatabaseIdTrait for DatabaseId {
    fn is_valid(&self) -> bool { *self != 0 }
}

make_database_id!(ItemId);
make_database_id!(UserId);
make_database_id!(ObjectId);
make_database_id!(RepositoryId);

#[cfg(feature = "password")]
make_wrapped_db_type!(PasswordHash, String, Clone, Default, Debug, serde::Serialize, serde::Deserialize);
#[cfg(feature = "password")]
impl PasswordHash {
    pub fn new(password_string: &crate::enc_string::EncString) -> Result<Self, anyhow::Error> {
        let s = Self(bcrypt::hash(password_string.encoded(), bcrypt::DEFAULT_COST)?);
        Ok(s)
    }

    pub fn verify(&self, password: &crate::enc_string::EncString) -> Result<bool, anyhow::Error> {
        Ok(bcrypt::verify(password.encoded(), self.0.as_str())?)
    }
}

