use crate::app_ctx::AppCtx;
use crate::permissions::Permissions;
use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Error, Json, Router};
use database::item::{DbItem, Trash};
use database::object::Object;
use std::sync::Arc;
use tokio::io;
use tokio_util::io::ReaderStream;
use types::database_ids::ItemId;
use utils::server_error::ServerError;
use video_server::error::StreamingError;
use video_server::media_info::stream_reference::StreamReference;
use video_server::media_stream::media_stream::MediaStream;
use video_server::media_stream::preset_description::PresetDescription;


pub struct ServerStreamError(ServerError);

impl From<StreamingError> for ServerStreamError {
    fn from(value: StreamingError) -> Self {
        Self(value.into())
    }
}
impl From<anyhow::Error> for ServerStreamError {
    fn from(value: anyhow::Error) -> Self {
        Self(value.into())
    }
}
impl From<io::Error> for ServerStreamError {
    fn from(value: io::Error) -> Self {
        Self(value.into())
    }
}

impl From<ServerError> for ServerStreamError {
    fn from(value: ServerError) -> Self {
        Self(value)
    }
}

impl IntoResponse for ServerStreamError {
    fn into_response(self) -> Response {
        self.0.into_response()
    }
}

pub struct StreamRoutes;
impl StreamRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        Ok(Router::new()
            .route("/create/{stream_id}", post(create_stream).with_state(ctx.clone()))
            .route("/{stream_id}/manifest/{start_num}", get(get_manifest).with_state(ctx.clone()))
            .route("/{stream_id}/init/{track_id}/{start_num}", get(get_init_chunk).with_state(ctx.clone()))
            .route("/{stream_id}/data/{track_id}/{chunk}", get(get_chunk).with_state(ctx.clone()))
        )
    }
}

async fn get_stream(ctx: &Arc<AppCtx>, item_id: ItemId, request: axum::http::Request<Body>) -> Result<Arc<MediaStream>, ServerStreamError> {
    let permissions = Permissions::new(&request)?;
    let item = DbItem::from_id(&ctx.database, &item_id, Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    let object = item.file.ok_or(ServerError::msg(StatusCode::METHOD_NOT_ALLOWED, "Not a valid file"))?.object;
    Ok(ctx.streaming_context().get_or_create_stream(&StreamReference::new(Object::data_path(&object, &ctx.database), item_id.to_string())).await?)
}

async fn create_stream(State(ctx): State<Arc<AppCtx>>, Path(item_id): Path<ItemId>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerStreamError> {
    let stream = get_stream(&ctx, item_id, request).await?;
    Ok(Json(stream.identifier().clone()))
}

async fn get_manifest(State(ctx): State<Arc<AppCtx>>, Path((item_id, start_num)): Path<(ItemId, u32)>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerStreamError> {
    let stream = get_stream(&ctx, item_id, request).await?;
    Ok(([(header::CONTENT_TYPE, "application/dash+xml")], stream.compile_dash_manifest(start_num).await.map_err(|err| <StreamingError as Into<ServerError>>::into(err))?))
}

async fn get_init_chunk(State(ctx): State<Arc<AppCtx>>, Path((item_id, track_id, start_num)): Path<(ItemId, u32, u32)>, preset: Query<PresetDescription>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerStreamError> {
    let stream = get_stream(&ctx, item_id, request).await?;
    let track = stream.get_track(track_id).await?;
    let preset = track.get_or_create_preset(&preset).await?;
    let path = preset.get_init(start_num).await?;
    let stream = ReaderStream::new(tokio::fs::File::open(&path).await?);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "video/mp4".to_string()),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", path.display()))
    ];
    Ok((headers, body))
}
async fn get_chunk(State(ctx): State<Arc<AppCtx>>, Path((item_id, track_id, chunk)): Path<(ItemId, u32, u32)>, preset: Query<PresetDescription>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerStreamError> {
    let stream = get_stream(&ctx, item_id, request).await?;
    let track = stream.get_track(track_id).await?;
    let preset = track.get_or_create_preset(&preset).await?;
    let path = preset.get_chunk(chunk).await?;
    let stream = ReaderStream::new(tokio::fs::File::open(&path).await?);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "video/mp4".to_string()),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", path.display()))
    ];
    Ok((headers, body))
}