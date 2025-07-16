use std::collections::HashMap;
use std::path::PathBuf;
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
use tracing::warn;
use database::repository::DbRepository;
use types::database_ids::{DatabaseId, ItemId, RepositoryId};
use types::item::{CreateDirectoryParams, DirectoryData, Item};

pub struct ItemRoutes {}

impl ItemRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        Ok(Router::new()
            .route("/find", post(find_items).with_state(ctx.clone()))
            .route("/move-to-trash", post(move_to_trash).with_state(ctx.clone()))
            .route("/delete", post(delete).with_state(ctx.clone()))
            .route("/restore", post(restore).with_state(ctx.clone()))
            .route("/new-directory", post(new_directory).with_state(ctx.clone()))
            .route("/directory-content", post(directory_content).with_state(ctx.clone()))
            .route("/content-to", post(content_to).with_state(ctx.clone()))
            .route("/thumbnail/{id}", get(thumbnail).with_state(ctx.clone()))
            .route("/send", post(send).with_state(ctx.clone()))
            .route("/get/{path}", get(download).with_state(ctx.clone()))
            .route("/download/{ids}", get(download_multi).with_state(ctx.clone()))
            .route("/preview/{path}", get(preview).with_state(ctx.clone()))
            .route("/update", post(edit).with_state(ctx.clone()))
            .route("/search", post(search).with_state(ctx.clone()))
            .route("/copy", post(copy).with_state(ctx.clone()))
        )
    }
}

/// Get item data from ID
async fn find_items(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for item in DbItem::from_ids(&ctx.database, &json.0, Trash::Both).await? {
        if permissions.view_item(&ctx.database, &item).await?.granted() {
            items.push(item);
        }
    }
    Ok(Json(items))
}

/// Get all items from root to this item recursively
async fn content_to(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = HashMap::new();
    for target in json.0 {
        let mut current_target = target;
        loop {
            let data = DbItem::from_id(&ctx.database, &current_target, Trash::Both).await?;
            if !permissions.view_item(&ctx.database, &data).await?.granted() {
                break;
            }
            for content_item in DbItem::from_parent(&ctx.database, data.id(), Trash::Both).await? {
                items.insert(content_item.id().clone(), content_item);
            }
            for content_item in DbItem::repository_root(&ctx.database, &data.repository, Trash::Both).await? {
                items.insert(content_item.id().clone(), content_item);
            }
            items.insert(data.id().clone(), data.clone());
            if let Some(parent) = data.parent_item {
                current_target = parent;
            } else {
                break;
            }
        }
    }
    Ok(Json(items.values().cloned().collect::<Vec<Item>>()))
}

/// Get items inside a given directory
async fn directory_content(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<ItemId>>::from_request(request, &ctx).await?;
    let mut items = vec![];
    for directory in json.0 {
        if permissions.view_item(&ctx.database, &DbItem::from_id(&ctx.database, &directory, Trash::Both).await?).await?.granted() {
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
            if !permissions.upload_to_directory(&ctx.database, &DbItem::from_id(&ctx.database, &parent_item, Trash::Both).await?).await?.granted() {
                warn!("Cannot upload to directory {}", parent_item);
                continue;
            }
        } else if !permissions.upload_to_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &params.repository).await?).await?.granted() {
            warn!("Cannot upload to repository {}", params.repository);
            continue;
        }

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
        if let Ok(mut item) = DbItem::from_id(&ctx.database, &item, Trash::No).await
        {
            if permissions.edit_item(&ctx.database, &item).await?.granted() {
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
        if let Ok(mut item) = DbItem::from_id(&ctx.database, &item, Trash::Yes).await {
            if permissions.edit_item(&ctx.database, &item).await?.granted() {
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
        let item = DbItem::from_id(&ctx.database, &item_id, Trash::Both).await?;
        if permissions.edit_item(&ctx.database, &item).await?.granted() {
            DbItem::delete(&item, &ctx.database).await?;
            items.push(item_id);
        }
    }
    Ok(Json(items))
}


/// Get item thumbnail if available
async fn thumbnail(State(ctx): State<Arc<AppCtx>>, Path(id): Path<DatabaseId>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let item = DbItem::from_id(&ctx.database, &ItemId::from(id), Trash::Both).await?;
    let permissions = Permissions::new(&request)?;
    permissions.view_item(&ctx.database, &item).await?.require()?;

    let file = match &item.file {
        None => { return Err(ServerError::msg(StatusCode::NOT_ACCEPTABLE, "Cannot generate thumbnail for a directory")) }
        Some(f) => { f }
    };

    let extension = match PathBuf::from(item.name.plain()?.as_str()).extension() {
        None => {String::new()}
        Some(extension) => {extension.display().to_string()}
    };

    let thumbnail_path = Thumbnail::find_or_create(&Object::data_path(&file.object, &ctx.database), &Object::thumbnail_path(&file.object, &ctx.database), &file.mimetype.plain()?, &extension, 100)?;

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
            permissions.upload_to_directory(&ctx.database, &DbItem::from_id(&ctx.database, parent, Trash::Both).await?).await?.require()?;
        } else {
            permissions.upload_to_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &upload.item().repository).await?).await?.require()?;
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
    permissions.view_item(&ctx.database, &item).await?.require()?;

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
async fn preview(State(ctx): State<Arc<AppCtx>>, Path(id): Path<DatabaseId>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let item = DbItem::from_id(&ctx.database, &ItemId::from(id), Trash::Both).await?;
    let permissions = Permissions::new(&request)?;
    permissions.view_item(&ctx.database, &item).await?.require()?;

    if let Some(file) = item.file {
        /*
                let mimetype = file.mimetype.plain()?;
                if mimetype.starts_with("video/") {
                    let object = Object::from_id(&ctx.database, &file.object).await?;
        
                    let headers = request.headers();
                    if let Some(range) = headers.get("range") {
                        let range = range.to_str()?.to_string();
                        warn!("Accept range for video : {:?}", range);
        
                        let mut range_type = range.split("=");
                        if let Some(range_type) = range_type.next() {
                            if range_type != "bytes" {
                                return Err(ServerError::msg(StatusCode::RANGE_NOT_SATISFIABLE, "invalid range type"));
                            }
                        } else {
                            return Err(ServerError::msg(StatusCode::RANGE_NOT_SATISFIABLE, "invalid range header"));
                        }
                        let range_value = match range_type.next() {
                            None => { return Err(ServerError::msg(StatusCode::RANGE_NOT_SATISFIABLE, "invalid range value")); }
                            Some(value) => { value }
                        };
        
                        let mut initial_values = range_value.split('-');
        
                        let start = match initial_values.next() {
                            None => { return Err(ServerError::msg(StatusCode::RANGE_NOT_SATISFIABLE, "cannot read range start")); }
                            Some(start) => { i64::from_str(start)? }
                        };
        
        
                        let mut data_file = tokio::fs::File::open(Object::data_path(object.id(), &ctx.database)).await?;
        
                        if let Err(err) = data_file.seek(SeekFrom::Start(start as u64)).await {
                            return Err(ServerError::msg(StatusCode::RANGE_NOT_SATISFIABLE, format!("Failed to seek to desired range : {err}")));
                        }
        
                        let stream = ReaderStream::new(data_file);
                        let body = Body::from_stream(stream);
        
                        let headers = [
                            (header::CONTENT_TYPE, mimetype.clone()),
                            (header::CONTENT_LENGTH, (file.size - start).to_string()),
                            (header::CONTENT_RANGE, format!("{}-{}/{}", start, file.size, file.size)),
                            (header::ACCEPT_RANGES, "bytes".to_string()),
                            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", item.name.encoded()))
                        ];
                        return Ok((StatusCode::PARTIAL_CONTENT, headers, body).into_response());
                    }
        
                    warn!("Respond video with range");
        
                    let stream = ReaderStream::new(tokio::fs::File::open(Object::data_path(object.id(), &ctx.database)).await?);
                    let body = Body::from_stream(stream);
        
                    let headers = [
                        (header::CONTENT_TYPE, file.mimetype.plain()?),
                        (header::CONTENT_LENGTH, file.size.to_string()),
                        (header::ACCEPT_RANGES, "bytes".to_string()),
                        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", item.name.encoded()))
                    ];
                    return Ok((StatusCode::OK, headers, body).into_response());
                }
        */
        let object = Object::from_id(&ctx.database, &file.object).await?;

        let stream = ReaderStream::new(tokio::fs::File::open(Object::data_path(object.id(), &ctx.database)).await?);
        let body = Body::from_stream(stream);

        let headers = [
            (header::CONTENT_TYPE, file.mimetype.plain()?),
            (header::CONTENT_LENGTH, file.size.to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", item.name.encoded()))
        ];
        return Ok((StatusCode::OK, headers, body).into_response());
    }
    Err(ServerError::msg(StatusCode::NOT_FOUND, "Cannot preview directory content"))
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
        let item = DbItem::from_id(&ctx.database, &item, Trash::Both).await?;
        permissions.view_item(&ctx.database, &item).await?.require()?;
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
        if let Ok(mut item) = DbItem::from_id(&ctx.database, &data.id, Trash::Both).await {
            if permissions.edit_item(&ctx.database, &item).await?.granted() {
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
        let item = DbItem::from_id(&ctx.database, data.id(), Trash::Both).await?;
        if permissions.view_item(&ctx.database, &item).await?.granted() {
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
        let directory = DbItem::from_id(&ctx.database, &directory, Trash::No).await?;
        permissions.upload_to_directory(&ctx.database, &directory).await?.require()?;
        Some(directory)
    } else { None };
    let destination_repository = DbRepository::from_id(&ctx.database, &data.destination_repository).await?;
    if destination_directory.is_none() {
        permissions.upload_to_repository(&ctx.database, &destination_repository).await?.require()?;
    }

    let mut items = vec![];
    for item in data.items {
        let mut item = DbItem::from_id(&ctx.database, &item, Trash::No).await?;
        if !permissions.view_item(&ctx.database, &item).await?.granted() { continue; }

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