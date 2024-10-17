use std::fmt;
use std::fmt::{Debug, Display, Formatter};
use std::ops::Deref;
use anyhow::Error;
use deunicode::deunicode;
use serde::{de, Deserialize, Deserializer, Serialize};
use serde::de::Visitor;
use tracing::error;
use crate::make_wrapped_db_type;

#[cfg(feature = "axum")]
use axum::http::HeaderValue;

make_wrapped_db_type!(EncString, String, Default, Serialize, Clone);

impl EncString {
    pub fn plain(&self) -> Result<String, Error> {
        Self::decode_encoded(self.0.as_str())
    }
    pub fn encoded(&self) -> &String {
        &self.0
    }
    pub fn is_empty(&self) -> bool { self.0.is_empty() }
    pub fn encode(string: &str) -> Self {
        Self(urlencoding::encode(string).to_string())
    }
    pub fn from_url_path(string: String) -> Result<Self, Error> {
        Self::new(string)
    }
    pub fn url_formated(&self) -> Result<Self, Error> {
        Ok(Self::encode(deunicode(self.plain()?.as_str())
            .replace(|c: char| !c.is_ascii_alphanumeric(), "/")
            .split("/").collect::<Vec<&str>>().into_iter()
            .filter(|item| !item.is_empty()).collect::<Vec<&str>>()
            .join("-").to_lowercase().as_str()))
    }

    pub fn decode_encoded(encoded: &str) -> Result<String, Error> {
        Ok(urlencoding::decode(encoded)?.to_string())
    }
    
    fn new(encoded: String) -> Result<Self, Error> {
        let encoded_test = encoded.replace("%", "a");
        if urlencoding::encode(encoded_test.as_str()) != encoded_test {
            Err(Error::msg(format!("'{}' is not an encoded string !! (expected '{}')", encoded, urlencoding::encode(encoded_test.as_str()))))
        } else {
            Ok(Self(encoded))
        }
    }

    pub fn from_os_string(string: &std::ffi::OsStr) -> Self {
        Self::encode(string.to_str().unwrap())
    }
}

impl<'de> Deserialize<'de> for EncString {
    fn deserialize<D>(deserializer: D) -> Result<EncString, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct EncStringVisitor;

        impl<'de> Visitor<'de> for EncStringVisitor {
            type Value = EncString;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("`encoded string`")
            }

            fn visit_str<E>(self, value: &str) -> Result<EncString, E>
            where
                E: de::Error,
            {
                match EncString::new(value.to_string()) {
                    Ok(res) => { Ok(res) }
                    Err(err) => {
                        error!("Invalid encoded string : {}", err);
                        Err(de::Error::custom(format!("Invalid encoded string : {}", err)))
                    }
                }
            }
        }
        deserializer.deserialize_string(EncStringVisitor)
    }
}

impl From<String> for EncString {
    fn from(value: String) -> Self {
        Self::encode(value.as_str())
    }
}

impl From<&str> for EncString {
    fn from(value: &str) -> Self {
        Self::encode(value)
    }
}

#[cfg(feature = "axum")]
impl TryFrom<&HeaderValue> for EncString {
    type Error = Error;
    fn try_from(value: &HeaderValue) -> Result<Self, Self::Error> {
        Self::new(value.to_str()?.to_string())
    }
}

impl Debug for EncString {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.0.as_str())
    }
}

impl Display for EncString {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.plain().unwrap().as_str())
    }
}

impl Deref for EncString {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        self.0.as_str()
    }
}