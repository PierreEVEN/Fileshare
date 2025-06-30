use std::path::PathBuf;
use crate::app_ctx::AppCtx;
use crate::permissions::Permissions;
use axum::body::Body;
use axum::extract::{FromRequest, Path, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Error, Json, Router};
use database::item::{DbItem, Trash};
use database::object::Object;
use std::sync::Arc;
use tokio_util::io::ReaderStream;
use types::database_ids::ItemId;
use utils::server_error::ServerError;
use video_server::media::MediaState;
use video_server::stream_id::StreamId;

pub struct StreamRoutes {

}

impl StreamRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        Ok(Router::new()
            .route("/create", post(create_stream).with_state(ctx.clone()))
            .route("/:stream_id/manifest/:start_num", get(get_manifest).with_state(ctx.clone()))
            .route("/:stream_id/kill", post(kill).with_state(ctx.clone()))
            .route("/:stream_id/init/:track_id/:start_num", get(get_init_chunk).with_state(ctx.clone()))
            .route("/:stream_id/stream.vtt", get(get_subtitle).with_state(ctx.clone()))
            .route("/:stream_id/stream.ass", get(get_subtitle_ass).with_state(ctx.clone()))
            .route("/:stream_id/data/:track_id/:chunk", get(get_chunk).with_state(ctx.clone()))
        )
    }
}

async fn create_stream(State(ctx): State<Arc<AppCtx>>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let item_id = Json::<ItemId>::from_request(request, &ctx).await?.0;
    let item = DbItem::from_id(&ctx.database, &item_id, Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    let object = item.file.ok_or(ServerError::msg(StatusCode::METHOD_NOT_ALLOWED, "Not a valid file"))?.object;
    let state = MediaState::new(ctx.config.backend_config.video_server.clone(), item_id, Object::data_path(&object, &ctx.database))?;
    let stream_id = ctx.create_stream(state).await?;
    Ok(Json(stream_id))
}

async fn kill(State(ctx): State<Arc<AppCtx>>, Path(stream_id): Path<StreamId>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let stream = ctx.get_stream(&stream_id).await.ok_or(ServerError::msg(StatusCode::NOT_FOUND, "Stream not found"))?;
    let item = DbItem::from_id(&ctx.database, stream.item_id(), Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    ctx.kill_stream(&stream_id).await;
    Ok(())
}

async fn get_manifest(State(ctx): State<Arc<AppCtx>>, Path((stream_id, start_num)): Path<(StreamId, u32)>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let stream = ctx.get_stream(&stream_id).await.ok_or(ServerError::msg(StatusCode::NOT_FOUND, "Stream not found"))?;
    let item = DbItem::from_id(&ctx.database, stream.item_id(), Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    Ok(([(header::CONTENT_TYPE, "application/dash+xml")], stream.get_dash_manifest(start_num)?))
}

async fn get_init_chunk(State(ctx): State<Arc<AppCtx>>, Path((stream_id, track_id, start_num)): Path<(StreamId, u32, u32)>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let stream = ctx.get_stream(&stream_id).await.ok_or(ServerError::msg(StatusCode::NOT_FOUND, "Stream not found"))?;
    let item = DbItem::from_id(&ctx.database, stream.item_id(), Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    let path = stream.get_init_chunk(track_id, start_num).await?;
    let stream = ReaderStream::new(tokio::fs::File::open(&path).await?);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "video/mp4".to_string()),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", path.display()))
    ];
    Ok((headers, body))
}
async fn get_chunk(State(ctx): State<Arc<AppCtx>>, Path((stream_id, track_id, chunk)): Path<(StreamId, u32, u32)>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let stream = ctx.get_stream(&stream_id).await.ok_or(ServerError::msg(StatusCode::NOT_FOUND, "Stream not found"))?;
    let item = DbItem::from_id(&ctx.database, stream.item_id(), Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;

    let path = stream.get_chunk(track_id, chunk).await?;
    let stream = ReaderStream::new(tokio::fs::File::open(&path).await?);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "video/mp4".to_string()),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", path.display()))
    ];
    Ok((headers, body))
}
async fn get_subtitle(State(ctx): State<Arc<AppCtx>>, Path(stream_id): Path<StreamId>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let stream = ctx.get_stream(&stream_id).await.ok_or(ServerError::msg(StatusCode::NOT_FOUND, "Stream not found"))?;
    let item = DbItem::from_id(&ctx.database, stream.item_id(), Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    Ok(())
}

async fn get_subtitle_ass(State(ctx): State<Arc<AppCtx>>, Path(stream_id): Path<StreamId>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let stream = ctx.get_stream(&stream_id).await.ok_or(ServerError::msg(StatusCode::NOT_FOUND, "Stream not found"))?;
    let item = DbItem::from_id(&ctx.database, stream.item_id(), Trash::Both).await?;
    permissions.view_item(&ctx.database, &item).await?.require()?;
    Ok(())
}