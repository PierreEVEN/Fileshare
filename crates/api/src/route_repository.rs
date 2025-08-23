use std::collections::{HashMap, HashSet};
use crate::app_ctx::AppCtx;
use crate::permissions::Permissions;
use crate::require_connected_user;
use crate::route_user::UserCredentials;
use anyhow::Error;
use axum::body::Body;
use axum::extract::{FromRequest, Path, Request, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use database::async_zip::AsyncDirectoryZip;
use database::item::{DbItem, Trash};
use database::repository::{DbRepository};
use database::subscription::{Subscription, SubscriptionAccessType};
use database::user::DbUser;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::SystemTime;
use tokio_util::io::ReaderStream;
use tracing::info;
use types::database_ids::{DatabaseId, ItemId, RepositoryId, UserId};
use types::enc_string::EncString;
use types::item::Item;
use types::repository::{Repository, RepositoryStatus};
use types::user::User;
use utils::server_error::ServerError;

pub struct RepositoryRoutes {}

impl RepositoryRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        let router = Router::new()
            .route("/find", post(find_repositories).with_state(ctx.clone()))
            .route("/content/{id}", get(content).with_state(ctx.clone()))
            .route("/available", get(get_available_repositories).with_state(ctx.clone()))
            .route("/public", get(get_public_repositories).with_state(ctx.clone()))
            .route("/create", post(create_repository).with_state(ctx.clone()))
            .route("/delete", post(delete_repository).with_state(ctx.clone()))
            .route("/root-content", post(root_content).with_state(ctx.clone()))
            .route("/fetch", post(fetch).with_state(ctx.clone()))
            .route("/download/{id}", get(download).with_state(ctx.clone()))
            .route("/update", post(update).with_state(ctx.clone()))
            .route("/subscribe", post(subscribe).with_state(ctx.clone()))
            .route("/unsubscribe", post(unsubscribe).with_state(ctx.clone()))
            .route("/stats", post(stats).with_state(ctx.clone()))
            .route("/subscriptions", post(subscriptions).with_state(ctx.clone()))
            .route("/trash-content", post(trash_content).with_state(ctx.clone()));
        Ok(router)
    }
}

async fn fetch(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    #[derive(Deserialize)]
    pub struct FetchData {
        items: Option<Vec<ItemId>>,
        repositories: Option<Vec<RepositoryId>>,
        users: Option<Vec<UserId>>,
        directory_content: Option<Vec<ItemId>>,
        repository_roots: Option<Vec<RepositoryId>>,
        trash_roots: Option<Vec<RepositoryId>>,
        content_to: Option<Vec<ItemId>>,
        item_permissions: Option<Vec<ItemId>>,
        repository_permissions: Option<Vec<RepositoryId>>
    }

    #[derive(Serialize)]
    pub struct RepositoryPermissionResults {
        repository: RepositoryId,
        perm: String
    }

    #[derive(Serialize)]
    pub struct ItemPermissionResults {
        item: ItemId,
        perm: String
    }

    #[derive(Serialize)]
    pub struct RepositoryContentResult {
        repository: RepositoryId,
        content: HashSet<ItemId>
    }

    #[derive(Serialize)]
    pub struct DirectoryContentResult {
        directory: ItemId,
        content: HashSet<ItemId>
    }

    #[derive(Serialize, Default)]
    pub struct FetchResult {
        #[serde(skip_serializing_if = "Option::is_none")]
        repositories: Option<Vec<Repository>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        users: Option<Vec<User>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        items: Option<Vec<Item>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        repository_roots: Option<Vec<RepositoryContentResult>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        trash_roots: Option<Vec<RepositoryContentResult>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        directory_content: Option<Vec<DirectoryContentResult>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        item_permissions: Option<Vec<ItemPermissionResults>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        repository_permissions: Option<Vec<RepositoryPermissionResults>>
    }

    let permissions = Permissions::new(&request)?;
    let json = Json::<FetchData>::from_request(request, &ctx).await.map_err(|err| { Error::msg(format!("Invalid body : {err}")) })?;
    let mut result = FetchResult::default();
    let mut output_repositories = HashMap::new();
    let mut output_repository_roots = HashMap::new();
    let mut output_directory_contents = HashMap::new();
    let mut output_users = HashMap::new();
    let mut output_items = HashMap::new();
    let mut output_item_permissions = HashMap::new();
    let mut output_repository_permissions = HashMap::new();

    if let Some(repositories) = &json.repositories {
        for repository in repositories {
            if !output_repositories.contains_key(repository) {
                if let Ok(repository) = DbRepository::from_id(&ctx.database, repository).await {
                    if permissions.view_repository(&ctx.database, &repository).await?.granted() {
                        output_repositories.insert(repository.id().clone(), repository);
                    }
                }
            }
        }
    }

    if let Some(users) = &json.users {
        for user in users {
            if !output_users.contains_key(user) {
                output_users.insert(user.clone(), DbUser::from_id(&ctx.database, user).await?);
            }
        }
    }

    if let Some(items) = &json.items {
        for item in items {
            if !output_items.contains_key(item) {
                let item = DbItem::from_id(&ctx.database, item, Trash::Both).await?;
                if permissions.view_item(&ctx.database, &item).await?.granted() {
                    output_items.insert(item.id().clone(), item);
                }
            }
        }
    }

    if let Some(repositories) = &json.repository_roots {
        for repository in repositories {
            if !output_repository_roots.contains_key(repository) {
                if permissions.view_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.granted()
                {
                    let mut content = HashSet::new();
                    for root_element in DbItem::repository_root(&ctx.database, &repository, Trash::Both).await? {
                        if !output_items.contains_key(root_element.id()) {
                            output_items.insert(root_element.id().clone(), root_element.clone());
                        }
                        content.insert(root_element.id().clone());
                    }
                    output_repository_roots.insert(repository.clone(), content);
                }
            }
        }
    }

    if let Some(repositories) = &json.trash_roots {
        let mut result_trash_roots = vec![];
        for repository in repositories {
            if permissions.upload_to_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.granted() {
                let mut content = HashSet::new();
                for root_element in DbItem::repository_trash_root(&ctx.database, &repository).await? {
                    if !output_items.contains_key(root_element.id()) {
                        output_items.insert(root_element.id().clone(), root_element.clone());
                    }
                    content.insert(root_element.id().clone());
                }
                result_trash_roots.push(RepositoryContentResult {
                    repository: repository.clone(),
                    content,
                });
            }
        }
        if !result_trash_roots.is_empty() {
            result.trash_roots = Some(result_trash_roots);
        }
    }

    if let Some(directories) = &json.directory_content {
        for directory in directories {
            if permissions.view_item(&ctx.database, &DbItem::from_id(&ctx.database, &directory, Trash::Both).await?).await?.granted() {
                let mut content = HashSet::new();
                for root_element in DbItem::from_parent(&ctx.database, &directory, Trash::Both).await? {
                    if !output_items.contains_key(root_element.id()) {
                        output_items.insert(root_element.id().clone(), root_element.clone());
                    }
                    content.insert(root_element.id().clone());
                }
                output_directory_contents.insert(directory.clone(), content);
            }
        }
    }

    if let Some(content_to) = &json.content_to {
        for target in content_to {
            let mut current_target = target.clone();
            loop {
                let data = DbItem::from_id(&ctx.database, &current_target, Trash::Both).await?;
                if !permissions.view_item(&ctx.database, &data).await?.granted() {
                    break;
                }
                if let Some(parent) = &data.parent_item {
                    if !output_directory_contents.contains_key(data.id()) {
                        let mut content = HashSet::new();
                        for content_item in DbItem::from_parent(&ctx.database, parent, Trash::Both).await? {
                            content.insert(content_item.id().clone());
                        }
                        output_directory_contents.insert(parent.clone(), content);
                    }
                } else {
                    if !output_repository_roots.contains_key(&data.repository) {
                        let mut content = HashSet::new();
                        for content_item in DbItem::repository_root(&ctx.database, &data.repository, Trash::Both).await? {
                            content.insert(content_item.id().clone());
                        }
                        output_repository_roots.insert(data.repository.clone(), content);
                    }
                }
                if !output_items.contains_key(data.id()) {
                    output_items.insert(data.id().clone(), data.clone());
                }
                if let Some(parent) = data.parent_item {
                    current_target = parent;
                } else {
                    break;
                }
            }
        }
    }


    if let Some(items) = &json.item_permissions {
        for item in items {
            let perm = if !permissions.view_item(&ctx.database, &DbItem::from_id(&ctx.database, &item, Trash::Both).await?).await?.granted() {
                String::new()
            } else if !permissions.upload_to_directory(&ctx.database, &DbItem::from_id(&ctx.database, &item, Trash::Both).await?).await?.granted() {
                String::from("r")
            } else if !permissions.edit_item(&ctx.database, &DbItem::from_id(&ctx.database, &item, Trash::Both).await?).await?.granted() {
                String::from("a")
            } else {
                String::from("f")
            };
            output_item_permissions.insert(item.clone(), perm);
        }
    }

    if let Some(repositories) = &json.repository_permissions {
        for repository in repositories {
            let perm = if !permissions.view_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.granted() {
                String::new()
            } else if !permissions.upload_to_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.granted() {
                String::from("r")
            } else if !permissions.edit_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.granted() {
                String::from("a")
            } else {
                String::from("f")
            };
            output_repository_permissions.insert(repository.clone(), perm);
        }
    }
    
    if !output_repositories.is_empty() {
        result.repositories = Some(output_repositories.values().cloned().collect());
    }
    if !output_users.is_empty() {
        result.users = Some(output_users.values().cloned().collect());
    }
    if !output_items.is_empty() {
        result.items = Some(output_items.values().cloned().collect());
    }
    if !output_repository_roots.is_empty() {
        let mut repository_roots = vec![];
        for (repository, content) in output_repository_roots {
            repository_roots.push({RepositoryContentResult {
                repository,
                content,
            }})
        }
        result.repository_roots = Some(repository_roots);
    }
    if !output_directory_contents.is_empty() {
        let mut directory_contents = vec![];
        for (directory, content) in output_directory_contents {
            directory_contents.push({DirectoryContentResult {
                directory,
                content,
            }})
        }
        result.directory_content = Some(directory_contents);
    }
    if !output_item_permissions.is_empty() {
        let mut perms = vec![];
        for (item, perm) in output_item_permissions {
            perms.push(ItemPermissionResults { item, perm });
        }
        result.item_permissions = Some(perms);
    }
    if !output_repository_permissions.is_empty() {
        let mut perms = vec![];
        for (repository, perm) in output_repository_permissions {
            perms.push(RepositoryPermissionResults { repository, perm });
        }
        result.repository_permissions = Some(perms);
    }
    Ok(Json(result))
}

/// Find repository by url name
async fn find_repositories(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<Json<Vec<Repository>>, ServerError> {
    let permission = Permissions::new(&request)?;
    let json = Json::<Vec<RepositoryId>>::from_request(request, &ctx).await.map_err(|err| { Error::msg(format!("Invalid body, {err} : expected Vec<RepositoryId>")) })?;
    let mut repositories = vec![];
    for repository in DbRepository::from_ids(&ctx.database, &json.0).await? {
        if permission.view_repository(&ctx.database, &repository).await?.granted() {
            repositories.push(repository);
        }
    }
    Ok(Json(repositories))
}

/// Create a new repository
async fn create_repository(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let user = require_connected_user!(request);

    if !user.can_create_repository() {
        return Err(ServerError::msg(StatusCode::FORBIDDEN, "Missing permissions"));
    }

    #[derive(Deserialize)]
    pub struct CreateReposData {
        name: EncString,
        status: String,
    }
    let repository_data = Json::<Vec<CreateReposData>>::from_request(request, &ctx).await?;
    let mut repositories = vec![];
    for data in repository_data.0 {
        if DbRepository::from_url_name(&ctx.database, &data.name.url_formated()?).await.is_ok() {
            return Err(ServerError::msg(StatusCode::FORBIDDEN, "A repository with this name already exists"));
        }
        let mut repository = Repository::default();
        repository.url_name = data.name.url_formated()?;
        repository.display_name = data.name.clone();
        repository.status = RepositoryStatus::from(data.status.clone());
        repository.owner = user.id().clone();
        DbRepository::push(&mut repository, &ctx.database).await?;
        repositories.push(repository);
    }
    Ok(Json(repositories))
}

/// Get repositories owned by connected user
async fn content(State(ctx): State<Arc<AppCtx>>, Path(id): Path<DatabaseId>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let repository = RepositoryId::from(id);
    let permissions = Permissions::new(&request)?;
    permissions.view_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.require()?;
    let items = DbItem::from_repository(&ctx.database, &repository, Trash::No).await?;
    Ok(Json(items))
}

/// Get repositories shared with connected user
async fn get_available_repositories(State(ctx): State<Arc<AppCtx>>, request: Request) -> impl IntoResponse {
    let user = require_connected_user!(request);

    #[derive(Serialize, Default)]
    pub struct Result {
        pub owned: Vec<RepositoryId>,
        pub shared: Vec<RepositoryId>,
    }

    let mut result = Result::default();

    for repository in DbRepository::from_user(&ctx.database, user.id()).await? {
        result.owned.push(repository.id().clone());
    }
    for repository in DbRepository::shared_with(&ctx.database, user.id()).await? {
        result.shared.push(repository.id().clone());
    }
    Ok(Json(result))
}

/// Get all public repositories
async fn get_public_repositories(State(ctx): State<Arc<AppCtx>>) -> Result<impl IntoResponse, ServerError> {
    Ok(Json(DbRepository::public(&ctx.database).await?))
}

/// Delete repository
async fn delete_repository(State(ctx): State<Arc<AppCtx>>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let connected_user = require_connected_user!(request);

    #[derive(Deserialize)]
    pub struct RequestParams {
        pub repositories: Vec<RepositoryId>,
        pub credentials: UserCredentials,
    }

    let data = Json::<RequestParams>::from_request(request, &ctx).await?;
    let from_creds = DbUser::from_credentials(&ctx.database, &data.credentials.login, &data.credentials.password).await?;

    let mut deleted_ids = vec![];

    for repository in &data.repositories {
        if connected_user.id() != from_creds.id() {
            continue;
        }
        let repository = DbRepository::from_id(&ctx.database, repository).await?;
        if repository.owner != *connected_user.id() {
            continue;
        }

        DbRepository::delete(&repository, &ctx.database).await?;
        deleted_ids.push(repository.id().clone());
    }
    Ok(Json(deleted_ids))
}

/// Get all root items of a repository
pub async fn root_content(State(ctx): State<Arc<AppCtx>>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permission = Permissions::new(&request)?;

    let data = Json::<Vec<RepositoryId>>::from_request(request, &ctx).await?;

    let mut result = vec![];
    for repository in data.0 {
        permission.view_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.require()?;
        result.append(&mut DbItem::repository_root(&ctx.database, &repository, Trash::Both).await?);
    }
    Ok(Json(result))
}

/// Get trash root items of a repository
pub async fn trash_content(State(ctx): State<Arc<AppCtx>>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permission = Permissions::new(&request)?;
    let data = Json::<Vec<RepositoryId>>::from_request(request, &ctx).await?;
    let mut result = vec![];
    for repository in data.0 {
        permission.upload_to_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &repository).await?).await?.require()?;
        result.append(&mut DbItem::repository_trash_root(&ctx.database, &repository).await?);
    }
    Ok(Json(result))
}

/// Update repository data
async fn update(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    require_connected_user!(request);

    #[derive(Deserialize, Debug)]
    struct Data {
        id: RepositoryId,
        display_name: EncString,
        url_name: EncString,
        max_file_size: Option<i64>,
        visitor_file_lifetime: Option<i64>,
        allow_visitor_upload: bool,
        status: String,
        description: Option<EncString>,
    }

    let permissions = Permissions::new(&request)?;
    let json = Json::<Vec<Data>>::from_request(request, &ctx).await?;
    let mut repositories = vec![];
    for data in json.0 {
        if let Ok(mut repository) = DbRepository::from_id(&ctx.database, &data.id).await {
            if permissions.edit_repository(&ctx.database, &repository).await?.granted() {
                repository.display_name = data.display_name;
                repository.description = data.description;
                repository.url_name = data.url_name;
                repository.max_file_size = data.max_file_size;
                repository.visitor_file_lifetime = data.visitor_file_lifetime;
                repository.allow_visitor_upload = data.allow_visitor_upload;
                repository.status = RepositoryStatus::from(data.status);
                DbRepository::push(&mut repository, &ctx.database).await?;
                repositories.push(repository.id().clone());
            }
        }
    }
    Ok(Json(repositories))
}

/// Download items or directory from a repository
async fn download(State(ctx): State<Arc<AppCtx>>, Path(id): Path<DatabaseId>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let repository = DbRepository::from_id(&ctx.database, &RepositoryId::from(id)).await?;
    let permissions = Permissions::new(&request)?;
    permissions.view_repository(&ctx.database, &repository).await?.require()?;

    let start = SystemTime::now();
    let mut zip = AsyncDirectoryZip::new();
    for item in DbItem::from_repository(&ctx.database, &RepositoryId::from(id), Trash::No).await? {
        zip.push_item(&ctx.database, item).await?;
    }

    let size = zip.size()?;

    let (w, r) = tokio::io::duplex(4096);
    tokio::spawn(async move {
        let res = zip.finalize(&ctx.database, w).await;
        return res;
    });
    info!("Prepared zip file for repository {} in {}s", id, SystemTime::now().duration_since(start)?.as_secs_f64());

    let body = Body::from_stream(ReaderStream::new(r));
    let headers = [
        (header::CONTENT_TYPE, "application/zip".to_string()),
        (header::CONTENT_LENGTH, size.to_string()),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", repository.display_name.encoded()))
    ];
    Ok((headers, body))
}

/// Subscribe user to a repository
async fn subscribe(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    require_connected_user!(request);

    #[derive(Deserialize, Debug)]
    struct Users {
        user: UserId,
        access_type: String,
    }

    #[derive(Deserialize, Debug)]
    struct Data {
        repository: RepositoryId,
        users: Vec<Users>,
    }

    let permissions = Permissions::new(&request)?;
    let data = Json::<Data>::from_request(request, &ctx).await?.0;
    permissions.edit_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &data.repository).await?).await?.require()?;
    let mut subscriptions = vec![];
    for user in &data.users {
        let mut subscription = Subscription::default();
        subscription.owner = user.user.clone();
        subscription.repository = data.repository.clone();
        subscription.access_type = SubscriptionAccessType::from(user.access_type.clone());
        subscription.push(&ctx.database).await?;
        subscriptions.push(subscription);
    }
    Ok(Json(subscriptions))
}

/// Remove user from subscribed users to a repository
async fn unsubscribe(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    require_connected_user!(request);

    #[derive(Deserialize, Debug)]
    struct Data {
        repository: RepositoryId,
        users: Vec<UserId>,
    }

    let permissions = Permissions::new(&request)?;
    let data = Json::<Data>::from_request(request, &ctx).await?.0;
    permissions.edit_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &data.repository).await?).await?.require()?;
    for user in &data.users {
        Subscription::find(&ctx.database, user, &data.repository).await?.delete(&ctx.database).await?;
    }
    Ok(())
}

/// Get all users subscribed to a repository
async fn subscriptions(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let data = Json::<RepositoryId>::from_request(request, &ctx).await?.0;
    permissions.edit_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &data).await?).await?.require()?;
    Ok(Json(Subscription::from_repository(&ctx.database, &data).await?))
}

/// Get repository stats
async fn stats(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let data = Json::<RepositoryId>::from_request(request, &ctx).await?.0;
    permissions.edit_repository(&ctx.database, &DbRepository::from_id(&ctx.database, &data).await?).await?.require()?;
    Ok(Json(DbRepository::stats(&DbRepository::from_id(&ctx.database, &data).await?, &ctx.database).await?))
}