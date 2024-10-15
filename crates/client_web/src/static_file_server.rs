use axum::extract::{Request, State};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use std::path::PathBuf;
use tokio::fs::File;
use tokio_util::io::ReaderStream;

pub struct StaticFileServer {}

#[derive(Clone)]
pub struct StaticRouterConfig {
    root_path: PathBuf,
}


use axum::body::{Body};
use axum::http::{header, StatusCode};
use utils::server_error::ServerError;

impl StaticFileServer {
    pub fn router(path: PathBuf) -> Router {
        let config = StaticRouterConfig {
            root_path: path,
        };

        Router::new()
            .route("/*file_path", get(Self::serve_file).with_state(config.clone()))
    }

    pub async fn serve_file_from_path(file_path: PathBuf) -> Result<impl IntoResponse, ServerError> {
        if file_path.exists() {
            let file_name = file_path.file_name().unwrap().to_str().unwrap().to_string();
            let mime_type = match mime_guess::from_path(file_path.clone()).first_raw() {
                None => { "application/octet-stream" }
                Some(mime_type) => { mime_type }
            };
            let file = File::open(file_path).await?;

            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);
            let headers = [
                (header::CONTENT_TYPE, mime_type),
                (header::CONTENT_DISPOSITION, &format!("attachment; filename=\"{}\"", file_name))
            ];

            Ok((headers, body).into_response())
        } else {
            Err(ServerError::msg(StatusCode::NOT_FOUND, format!("File not found ! (searching {})", file_path.display())))
        }
    }

    async fn serve_file(State(ctx): State<StaticRouterConfig>, request: Request) -> Result<impl IntoResponse, ServerError> {
        let file_path = ctx.root_path.join(PathBuf::from(String::from(".") + request.uri().path()));
        if !file_path.canonicalize()?.starts_with(ctx.root_path.canonicalize()?) {
            return Err(ServerError::msg(StatusCode::UNAUTHORIZED, "Cannot access elements outside public directory"));
        }

        Self::serve_file_from_path(file_path).await
    }
}