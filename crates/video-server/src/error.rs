use std::fmt::{Debug, Display, Formatter};
use std::ops::Deref;
use utils::server_error::ServerError;

pub enum ErrorKind {
    InitNotFound { track: u32, num: u32 },
    ChunkNotFound { track: u32, num: u32 },
    MissingData(&'static str),
    ParseError(String),
    Io(std::io::Error),
    Other(String),
    NoTrack(u32),
}

pub struct StreamingError(ErrorKind);

impl StreamingError {
    pub fn new(error_kind: ErrorKind) -> Self {
        Self(error_kind)
    }
}

impl Deref for StreamingError {
    type Target = ErrorKind;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Debug for StreamingError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        std::fmt::Display::fmt(&self, f)
    }
}

impl Display for StreamingError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match &self.0 {
            ErrorKind::Other(value) => f.write_str(value.as_str()),
            ErrorKind::Io(io) => std::fmt::Display::fmt(&io, f),
            ErrorKind::InitNotFound { track, num } => {
                f.write_fmt(format_args!("Init chunk not found {}:{}", track, num))
            }
            ErrorKind::ChunkNotFound { track, num } => {
                f.write_fmt(format_args!("Chunk not found {}:{}", track, num))
            }
            ErrorKind::MissingData(field) => {
                f.write_fmt(format_args!("Missing data field: {}", field))
            }
            ErrorKind::ParseError(err) => std::fmt::Display::fmt(&err, f),
            ErrorKind::NoTrack(id) => f.write_fmt(format_args!("No track with id: {}", id)),
        }
    }
}

impl From<std::io::Error> for StreamingError {
    fn from(err: std::io::Error) -> Self {
        Self(ErrorKind::Io(err))
    }
}

impl From<serde_json::Error> for StreamingError {
    fn from(err: serde_json::Error) -> Self {
        Self(ErrorKind::ParseError(err.to_string()))
    }
}

impl Into<ServerError> for StreamingError {
    fn into(self) -> ServerError {
        let message = self.to_string();
        match &self.0 {
            ErrorKind::InitNotFound { .. } => ServerError::code(404, message),
            ErrorKind::ChunkNotFound { .. } => ServerError::code(404, message),
            ErrorKind::MissingData(_) => ServerError::code(500, message),
            ErrorKind::ParseError(_) => ServerError::code(500, message),
            ErrorKind::Io(_) => ServerError::code(500, message),
            ErrorKind::Other(_) => ServerError::code(500, message),
            ErrorKind::NoTrack(_) => ServerError::code(404, message),
        }
    }
}
