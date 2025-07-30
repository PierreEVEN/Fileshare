use std::io;
use std::string::FromUtf8Error;
use anyhow::Error;

#[derive(Debug)]
pub enum ConverterError {
    ToolNotAvailable(String),
    NoSource,
    TaskNotAcceptable,
    Other(Error)
}

impl From<Error> for ConverterError {
    fn from(value: Error) -> Self {
        Self::Other(value)
    }
}

impl From<io::Error> for ConverterError {
    fn from(value: io::Error) -> Self {
        Self::Other(Error::from(value))
    }
}

impl From<FromUtf8Error> for ConverterError {
    fn from(value: FromUtf8Error) -> Self {
        Self::Other(Error::from(value))
    }
}