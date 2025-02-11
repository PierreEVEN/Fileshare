use axum::http::StatusCode;
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
}


impl IntoResponse for ServerError {
    fn into_response(self) -> Response {
        (
            self.0.0,
            format!("{}: {}", self.0.0.as_str(), self.0.1),
        ).into_response()
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