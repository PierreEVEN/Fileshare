use std::fmt::{Display, Formatter};
use std::io;
use std::string::FromUtf8Error;

#[derive(Debug, Clone)]
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

impl Display for ConverterError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            ConverterError::ToolNotAvailable(reason) => {f.write_fmt(format_args!("Tool not available : {reason}"))}
            ConverterError::InvalidInput(info) => {f.write_fmt(format_args!("Invalid input : {info}"))}
            ConverterError::ConversionFailed(error) => {f.write_fmt(format_args!("Converter failed : {error}"))}
            ConverterError::TaskNotAcceptable => {f.write_fmt(format_args!("Task not acceptable"))}
            ConverterError::Other(other) => {f.write_fmt(format_args!("Converter error : {other}"))}
        }
    }
}