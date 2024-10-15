use std::fmt;
use std::fmt::{Display, Formatter};
use anyhow::Error;
use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use serde::de::Visitor;
use crate::enc_string::EncString;

#[derive(Default, Debug, Clone)]
pub struct EncPath(Vec<EncString>);

impl EncPath {
    pub fn plain(&self) -> Result<String, Error> {
        let mut res = String::new();
        
        for item in &self.0 {
            res += "/";
            res += item.plain()?.as_str();
        }
        
        Ok(res)
    }
}

impl Display for EncPath {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        for item in &self.0 {
            f.write_str("/")?;
            f.write_str(item.encoded().as_str())?
        }
        Ok(())
    }
}

#[cfg(feature = "tokio-postgres")]
impl postgres_types::ToSql for EncPath {
    fn to_sql(&self, ty: &postgres_types::Type, out: &mut postgres_types::private::BytesMut) -> Result<postgres_types::IsNull, Box<dyn std::error::Error + Sync + Send>> {
        let mut result = String::new();
        for elem in &self.0 {
            result += "/";
            result += elem.encoded();
        }
        result.to_sql(ty, out)
    }
    fn accepts(ty: &postgres_types::Type) -> bool { <String>::accepts(ty) }
    postgres_types::to_sql_checked!();
}
#[cfg(feature = "tokio-postgres")]
impl<'a> postgres_types::FromSql<'a> for EncPath {
    fn from_sql(ty: &postgres_types::Type, raw: &'a [u8]) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        let data = <String>::from_sql(ty, raw)?;
        let items: Vec<&str> = data.split("/").filter(|it| { !it.is_empty() }).collect();
        let mut elements = vec![];
        for item in items {
            elements.push(EncString::from_url_path(item.to_string())?);
        }
        Ok(Self(elements))
    }
    fn accepts(ty: &postgres_types::Type) -> bool { <String>::accepts(ty) }
}
impl From<Vec<EncString>> for EncPath {
    fn from(value: Vec<EncString>) -> Self {
        Self(value)
    }
}

impl<'de> Deserialize<'de> for EncPath {
    fn deserialize<D>(deserializer: D) -> Result<EncPath, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct EncPathVisitor;

        impl<'de> Visitor<'de> for EncPathVisitor {
            type Value = EncPath;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("`encoded path`")
            }

            fn visit_str<E>(self, value: &str) -> Result<EncPath, E>
            where
                E: de::Error,
            {
                let items: Vec<&str> = value.split("/").filter(|it| { !it.is_empty() }).collect();
                let mut elements = vec![];
                for item in items {
                    elements.push(
                        match EncString::from_url_path(item.to_string()) {
                            Ok(res) => { res }
                            Err(err) => { return Err(de::Error::custom(format!("Invalid encoded path : {}", err))) }
                        });
                }
                Ok(EncPath(elements))
            }
        }
        deserializer.deserialize_string(EncPathVisitor)
    }
}


impl Serialize for EncPath {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut result = String::new();
        for elem in &self.0 {
            result += "/";
            result += elem.encoded();
        }
        serializer.serialize_str(result.as_str())
    }
}
