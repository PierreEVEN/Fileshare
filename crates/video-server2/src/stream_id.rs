use types::database_ids::DatabaseId;

#[derive(Copy, Clone, Default)]
pub struct StreamId(DatabaseId);
impl std::ops::Deref for StreamId {
    type Target = DatabaseId;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl PartialEq<Self> for StreamId {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}
impl Eq for StreamId {}

impl std::hash::Hash for StreamId {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.0.hash(state)
    }
}

impl From<DatabaseId> for StreamId {
    fn from(value: DatabaseId) -> Self {
        Self(value)
    }
}
impl std::fmt::Display for StreamId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        <DatabaseId as std::fmt::Display>::fmt(&self.0, f)
    }
}

impl<'de> serde::Deserialize<'de> for StreamId {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<StreamId, D::Error> {
        struct DbIdVisitor;
        impl<'de> serde::de::Visitor<'de> for DbIdVisitor {
            type Value = StreamId;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("int64 id in string format")
            }

            fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<StreamId, E> {
                use std::str::FromStr;
                Ok(StreamId(match DatabaseId::from_str(value) {
                    Ok(id) => id,
                    Err(err) => {
                        return Err(serde::de::Error::custom(format!(
                            "Failed to parse id : {}",
                            err
                        )));
                    }
                }))
            }
        }
        deserializer.deserialize_string(DbIdVisitor)
    }
}

impl serde::Serialize for StreamId {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.0.to_string().as_str())
    }
}
