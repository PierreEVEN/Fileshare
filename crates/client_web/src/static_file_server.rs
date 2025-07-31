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
            .route("/{*file_path}", get(Self::serve_file).with_state(config.clone()))
    }

    pub async fn serve_file_from_path(file_path: PathBuf, immutable: bool) -> Result<impl IntoResponse, ServerError> {
        if file_path.exists() {
            let file_name = file_path.file_name().unwrap().to_str().unwrap().to_string();
            let mime_type = match mime_guess::from_path(file_path.clone()).first_raw() {
                None => { "application/octet-stream" }
                Some(mime_type) => { mime_type }
            };
            let file = File::open(file_path).await?;

            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);

            if immutable {
                let headers = [
                    (header::CONTENT_TYPE, mime_type.to_string()),
                    (header::CACHE_CONTROL, "public, max-age=31536000, immutable".to_string()),
                    (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", file_name))
                ];

                Ok((headers, body).into_response())
            } else {
                let headers = [
                    (header::CONTENT_TYPE, mime_type.to_string()),
                    (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", file_name))
                ];
                Ok((headers, body).into_response())
            }
        } else {
            Err(ServerError::msg(StatusCode::NOT_FOUND, format!("File not found ! (searching {})", file_path.display())))
        }
    }

    async fn serve_file(State(ctx): State<StaticRouterConfig>, request: Request) -> Result<impl IntoResponse, ServerError> {
        let file_path = ctx.root_path.join(PathBuf::from(String::from(".") + request.uri().path()));
        if !file_path.canonicalize()?.starts_with(ctx.root_path.canonicalize()?) {
            return Err(ServerError::msg(StatusCode::UNAUTHORIZED, "Cannot access elements outside public directory"));
        }

        if let Some(extension) = file_path.extension() {
            if let Some(extension) = extension.to_str() {
                match extension {
                    "js" | "css" => return Self::serve_file_from_path(file_path, false).await,
                    _ => {}
                }
            }
        }

        Self::serve_file_from_path(file_path, true).await
    }
}