use std::io;
use std::string::FromUtf8Error;

#[derive(Debug)]
pub enum ConverterError {
    ToolNotAvailable(String),
    InvalidInput(String),
    ConversionFailed(String),
    TaskNotAcceptable,
    Other(String)
}

impl From<io::Error> for ConverterError {
    fn from(value: io::Error) -> Self {
        Self::Other(value.to_string())
    }
}

impl From<FromUtf8Error> for ConverterError {
    fn from(value: FromUtf8Error) -> Self {
        Self::Other(value.to_string())
    }
}