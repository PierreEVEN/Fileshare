use std::fmt::Formatter;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};

pub struct ServerError((StatusCode, anyhow::Error));

impl ServerError {
    pub fn error<E: Into<anyhow::Error>>(code: StatusCode, msg: E) -> Self {
        Self((code, msg.into()))
    }

    pub fn msg<E>(code: StatusCode, msg: E) -> Self
    where E: std::fmt::Display + std::fmt::Debug + Send + Sync + 'static {
        Self((code, anyhow::Error::msg(msg)))
    }


    pub fn code<E>(code: u16, msg: E) -> Self
    where E: std::fmt::Display + std::fmt::Debug + Send + Sync + 'static {
        match StatusCode::from_u16(code) {
            Ok(code) => {Self((code, anyhow::Error::msg(msg)))}
            Err(error) => {error.into()}
        }
    }
}

impl std::fmt::Display for ServerError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!("{} : {}", self.0.0, self.0.1))
    }
}

impl IntoResponse for ServerError {
    fn into_response(self) -> Response {
        ([(header::CACHE_CONTROL, "no-store".to_string())], (
            self.0.0,
            format!("{}: {}", self.0.0.as_str(), self.0.1),
        )).into_response()
    }
}

impl<E> From<E> for ServerError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self((StatusCode::INTERNAL_SERVER_ERROR, err.into()))
    }
}