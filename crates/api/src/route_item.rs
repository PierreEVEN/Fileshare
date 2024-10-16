use std::str::FromStr;
use crate::app_ctx::AppCtx;
use database::item::{DbItem, ItemSearchData, Trash};
use database::object::Object;
use crate::{require_connected_user};
use database::async_zip::AsyncDirectoryZip;
use types::enc_string::EncString;
use crate::permissions::Permissions;
use utils::server_error::ServerError;
use thumbnailer::Thumbnail;
use crate::upload::Upload;
use anyhow::Error;
use axum::body::Body;
use axum::extract::{FromRequest, Path, Request, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use regex::Regex;
use serde::Deserialize;
use std::sync::Arc;
use tokio_util::io::ReaderStream;
use database::repository::DbRepository;
use types::database_ids::{DatabaseId, ItemId, RepositoryId};
use types::item::{CreateDirectoryParams, DirectoryData, Item};

pub struct ItemRoutes {}

impl ItemRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        Ok(Router::new()
            .route("/find/", post(find_items).with_state(ctx.clone()))
            .route("/move-to-trash/", post(move_to_trash).with_state(ctx.clone()))
            .route("/delete/", post(delete).with_state(ctx.clone()))
            .route("/restore/", post(restore).with_state(ctx.clone()))
            .route("/new-directory/", post(new_directory).with_state(ctx.clone()))
            .route("/directory-content/", post(directory_content).with_state(ctx.clone()))
            .route("/thumbnail/:id/", get(thumbnail).with_state(ctx.clone()))
            .route("/send/", post(send).with_state(ctx.clone()))
            .route("/get/:path/", get(download).with_state(ctx.clone()))
            .route("/download/:ids/", get(download_multi).with_state(ctx.clone()))
            .route("/preview/:path/", get(download).with_state(ctx.clone()))
            .route("/update/", post(edit).with_state(ctx.clone()))
            .route("/search/", post(search).with_state(ctx.clone()))
            .route("/copy/", post(copy).with_state(ctx.clone()))
        )
    }
}

/// Get item data from ID
async fn find_items(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for item_id in json.0 {
        if permissions.view_item(&ctx.database, &item_id).await?.granted() {
            items.push(DbItem::from_id(&ctx.database, &item_id, Trash::Both).await?)
        }
    }
    Ok(Json(items))
}

/// Get items inside a given directory
async fn directory_content(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for directory in json.0 {
        if permissions.view_item(&ctx.database, &directory).await?.granted() {
            items.append(&mut DbItem::from_parent(&ctx.database, &directory, Trash::Both).await?);
        }
    }
    Ok(Json(items))
}

/// Create a directory
async fn new_directory(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let user = require_connected_user!(request);

    let json = Json::<Vec<CreateDirectoryParams>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for params in json.0 {
        let mut item = Item::default();

        if let Some(parent_item) = &params.parent_item {
            if !permissions.upload_to_directory(&ctx.database, parent_item).await?.granted() { continue; }
        } else if !permissions.upload_to_repository(&ctx.database, &params.repository).await?.granted() { continue; }

        let re = Regex::new(r#"[<>:"/\\|?*\x00-\x1F]|^(?:aux|con|clock\$|nul|prn|com[1-9]|lpt[1-9])$"#)?;
        if re.is_match(item.name.plain()?.as_str()) {
            return Err(ServerError::msg(StatusCode::NOT_ACCEPTABLE, format!("Invalid directory name '${}'", item.name.plain()?)));
        }

        item.name = params.name;
        item.repository = if let Some(parent) = &params.parent_item { DbItem::from_id(&ctx.database, parent, Trash::Both).await?.repository } else { params.repository };
        item.parent_item = params.parent_item;
        item.owner = user.id().clone();
        item.directory = Some(DirectoryData {
            open_upload: false,
            num_items: 0,
            content_size: 0,
        });

        DbItem::push(&mut item, &ctx.database).await?;

        items.push(item);
    }
    Ok(Json(items))
}

/// Move item to trash
async fn move_to_trash(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for item in json.0 {
        if permissions.edit_item(&ctx.database, &item).await?.granted() {
            if let Ok(mut item) = DbItem::from_id(&ctx.database, &item, Trash::No).await
            {
                item.in_trash = true;
                DbItem::push(&mut item, &ctx.database).await?;
                items.push(item.id().clone());
            }
        }
    }
    Ok(Json(items))
}

/// Restore item from trash
async fn restore(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for item in json.0 {
        if permissions.edit_item(&ctx.database, &item).await?.granted() {
            if let Ok(mut item) = DbItem::from_id(&ctx.database, &item, Trash::Yes).await {
                item.in_trash = false;
                DbItem::push(&mut item, &ctx.database).await?;
                items.push(item.id().clone());
            }
        }
    }
    Ok(Json(items))
}


/// Permanently delete item
async fn delete(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for item_id in json.0 {
        if permissions.edit_item(&ctx.database, &item_id).await?.granted() {
            DbItem::delete(&DbItem::from_id(&ctx.database, &item_id, Trash::Both).await?, &ctx.database).await?;
            items.push(item_id);
        }
    }
    Ok(Json(items))
}


/// Get item thumbnail if available
async fn thumbnail(State(ctx): State<Arc<AppCtx>>, Path(id): Path<DatabaseId>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let item = DbItem::from_id(&ctx.database, &ItemId::from(id), Trash::Both).await?;
    let permissions = Permissions::new(&request)?;
    permissions.view_item(&ctx.database, item.id()).await?.require()?;

    let file = match &item.file {
        None => { return Err(ServerError::msg(StatusCode::NOT_ACCEPTABLE, "Cannot generate thumbnail for a directory")) }
        Some(f) => { f }
    };

    let thumbnail_path = Thumbnail::find_or_create(&Object::data_path(&file.object, &ctx.database), &Object::thumbnail_path(&file.object, &ctx.database), &file.mimetype.plain()?, 100)?;

    let stream = ReaderStream::new(tokio::fs::File::open(thumbnail_path).await?);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "image/webp".to_string()),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", item.name.encoded()))
    ];
    Ok((headers, body))
}


/// Upload item
async fn send(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let connected_user = require_connected_user!(request);
    let headers = request.headers().clone();
    let id = if let Some(content_id) = headers.get("Content-Id") {
        content_id.to_str()?.to_string()
    } else {
        // Register new upload
        let upload = Upload::new(headers, connected_user.id().clone())?;
        if let Some(parent) = &upload.item().parent_item {
            permissions.upload_to_directory(&ctx.database, parent).await?.require()?;
        } else {
            permissions.upload_to_repository(&ctx.database, &upload.item().repository).await?.require()?;
        }
        ctx.add_upload(upload).await?
    };

    let mut state = {
        let found_upload = ctx.get_upload(&id).await?;
        let mut upload = found_upload.write().await;
        upload.push_data(request.into_body()).await?;
        upload.get_state()
    };
    if state.finished {
        state = ctx.finalize_upload(&id, &ctx.database).await?;
    }
    Ok(Json(state))
}

/// Download item or directory
async fn download(State(ctx): State<Arc<AppCtx>>, Path(id): Path<DatabaseId>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let item = DbItem::from_id(&ctx.database, &ItemId::from(id), Trash::Both).await?;
    let permissions = Permissions::new(&request)?;
    permissions.view_item(&ctx.database, item.id()).await?.require()?;

    if let Some(file) = item.file {
        let object = Object::from_id(&ctx.database, &file.object).await?;

        let stream = ReaderStream::new(tokio::fs::File::open(Object::data_path(object.id(), &ctx.database)).await?);
        let body = Body::from_stream(stream);

        let headers = [
            (header::CONTENT_TYPE, file.mimetype.plain()?),
            (header::CONTENT_LENGTH, file.size.to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", item.name.encoded()))
        ];
        Ok((headers, body))
    } else {
        let mut zip = AsyncDirectoryZip::new();
        zip.push_item(&ctx.database, item.clone()).await?;

        let size = zip.size()?;

        let (w, r) = tokio::io::duplex(4096);
        tokio::spawn(async move {
            zip.finalize(&ctx.database, w).await
        });

        let body = Body::from_stream(ReaderStream::new(r));
        let headers = [
            (header::CONTENT_TYPE, "application/zip".to_string()),
            (header::CONTENT_LENGTH, size.to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", item.name.encoded()))
        ];
        Ok((headers, body))
    }
}

/// Download item or directory
async fn download_multi(State(ctx): State<Arc<AppCtx>>, Path(ids): Path<String>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let mut items = vec![];
    for str in ids.split('-') {
        if !str.is_empty() {
            items.push(ItemId::from(DatabaseId::from_str(str)?))
        }
    }
    let permissions = Permissions::new(&request)?;

    let mut zip = AsyncDirectoryZip::new();
    for item in items {
        permissions.view_item(&ctx.database, &item).await?.require()?;
        let item = DbItem::from_id(&ctx.database, &item, Trash::Both).await?;
        zip.push_item(&ctx.database, item.clone()).await?;
    }
    let size = zip.size()?;

    let (w, r) = tokio::io::duplex(4096);
    tokio::spawn(async move {
        zip.finalize(&ctx.database, w).await
    });

    let body = Body::from_stream(ReaderStream::new(r));
    let headers = [
        (header::CONTENT_TYPE, "application/zip".to_string()),
        (header::CONTENT_LENGTH, size.to_string()),
        (header::CONTENT_DISPOSITION, "attachment; filename=\"Archive.zip\"".to_string())
    ];
    Ok((headers, body))
}

/// Update item data
async fn edit(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    require_connected_user!(request);

    #[derive(Deserialize, Debug)]
    struct Data {
        id: ItemId,
        name: EncString,
        description: Option<EncString>,
        open_upload: Option<bool>,
    }

    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<Data>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for data in json.0 {
        if permissions.edit_item(&ctx.database, &data.id).await?.granted() {
            if let Ok(mut item) = DbItem::from_id(&ctx.database, &data.id, Trash::Both).await {
                item.name = data.name;
                item.description = data.description;

                if let Some(open_upload) = data.open_upload {
                    if let Some(directory) = &mut item.directory {
                        directory.open_upload = open_upload
                    }
                }

                DbItem::push(&mut item, &ctx.database).await?;
                items.push(item.id().clone());
            }
        }
    }
    Ok(Json(items))
}

/// Search item by filter
async fn search(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let data = Json::<ItemSearchData>::from_request(request, &ctx).await?.0;
    let result = DbItem::search(&ctx.database, data).await?;
    let mut items = vec![];
    for data in result {
        if permissions.view_item(&ctx.database, data.id()).await?.granted() {
            items.push(data.id().clone());
        }
    }
    Ok(Json(items))
}

/// Search item by filter
async fn copy(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;

    #[derive(Deserialize)]
    pub struct Copy {
        destination_repository: RepositoryId,
        destination_directory: Option<ItemId>,
        items: Vec<ItemId>,
        remove_sources: bool,
    }

    let data = Json::<Copy>::from_request(request, &ctx).await?.0;

    let destination_directory = if let Some(directory) = data.destination_directory {
        permissions.upload_to_directory(&ctx.database, &directory).await?.require()?;
        Some(DbItem::from_id(&ctx.database, &directory, Trash::No).await?)
    } else { None };
    let destination_repository = DbRepository::from_id(&ctx.database, &data.destination_repository).await?;
    if destination_directory.is_none() {
        permissions.upload_to_repository(&ctx.database, destination_repository.id()).await?.require()?;
    }

    let mut items = vec![];
    for item in data.items {
        if !permissions.view_item(&ctx.database, &item).await?.granted() { continue; }
        let mut item = DbItem::from_id(&ctx.database, &item, Trash::No).await?;

        if let Some(parent_dir) = &destination_directory {
            item.parent_item = Some(parent_dir.id().clone());
            item.repository = parent_dir.repository.clone();
        } else {
            item.parent_item = None;
            item.repository = destination_repository.id().clone();
        }
        if data.remove_sources {
            DbItem::push(&mut item, &ctx.database).await?;
            items.push(item);
        } else {
            // Create a new item
            let old_directory = item.clear_id();
            DbItem::push(&mut item, &ctx.database).await?;
            if item.directory.is_some() {
                let mut directories_to_copy = vec![];
                directories_to_copy.push((old_directory, item.id().clone()));

                // Copy directory content recursively
                while let Some((old, new)) = directories_to_copy.pop() {
                    let children = DbItem::from_parent(&ctx.database, &old, Trash::No).await?;
                    for child in children {
                        let mut child = child.clone();
                        let old_id = child.clear_id();
                        child.repository = item.repository.clone();
                        child.parent_item = Some(new.clone());
                        DbItem::push(&mut child, &ctx.database).await?;
                        if child.directory.is_some() {
                            directories_to_copy.push((old_id, child.id().clone()));
                        }
                        items.push(child);
                    }
                }
            }
            items.push(item);
        }
    }
    Ok(Json(items))
}