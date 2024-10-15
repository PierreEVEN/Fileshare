use database::item::{DbItem, Trash};
use crate::require_connected_user;
use crate::route_user::UserCredentials;
use crate::permissions::Permissions;
use utils::server_error::ServerError;
use anyhow::Error;
use axum::body::Body;
use axum::extract::{FromRequest, Path, Request, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize};
use std::sync::Arc;
use tokio_util::io::ReaderStream;
use database::subscription::{Subscription, SubscriptionAccessType};
use database::async_zip::AsyncDirectoryZip;
use database::repository::DbRepository;
use database::user::DbUser;
use types::database_ids::{DatabaseId, RepositoryId, UserId};
use types::enc_string::EncString;
use types::repository::{Repository, RepositoryStatus};
use crate::app_ctx::AppCtx;

pub struct RepositoryRoutes {}

impl RepositoryRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        let router = Router::new()
            .route("/find/", post(find_repositories).with_state(ctx.clone()))
            .route("/content/:id/", get(content).with_state(ctx.clone()))
            .route("/owned/", get(get_owned_repositories).with_state(ctx.clone()))
            .route("/shared/", get(get_shared_repositories).with_state(ctx.clone()))
            .route("/public/", get(get_public_repositories).with_state(ctx.clone()))
            .route("/create/", post(create_repository).with_state(ctx.clone()))
            .route("/delete/", post(delete_repository).with_state(ctx.clone()))
            .route("/root-content/", post(root_content).with_state(ctx.clone()))
            .route("/download/:id/", get(download).with_state(ctx.clone()))
            .route("/update/", post(update).with_state(ctx.clone()))
            .route("/subscribe/", post(subscribe).with_state(ctx.clone()))
            .route("/unsubscribe/", post(unsubscribe).with_state(ctx.clone()))
            .route("/stats/", post(stats).with_state(ctx.clone()))
            .route("/subscriptions/", post(subscriptions).with_state(ctx.clone()))
            .route("/trash-content/", post(trash_content).with_state(ctx.clone()));
        Ok(router)
    }
}

/// Find repository by url name
async fn find_repositories(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<Json<Vec<Repository>>, ServerError> {
    let permission = Permissions::new(&request)?;
    let json = Json::<Vec<RepositoryId>>::from_request(request, &ctx).await.map_err(|err| { Error::msg(format!("Invalid body, {err} : expected Vec<RepositoryId>")) })?;
    let mut repositories = vec![];
    for repository in &json.0 {
        if permission.view_repository(&ctx.database, repository).await?.granted() {
            repositories.push(DbRepository::from_id(&ctx.database, repository).await?);
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
    permissions.view_repository(&ctx.database, &repository).await?.require()?;
    let items = DbItem::from_repository(&ctx.database, &repository, Trash::No).await?;
    Ok(Json(items))
}


/// Get repositories owned by connected user
async fn get_owned_repositories(State(ctx): State<Arc<AppCtx>>, request: Request) -> impl IntoResponse {
    let user = require_connected_user!(request);
    Ok(Json(DbRepository::from_user(&ctx.database, user.id()).await?))
}

/// Get repositories shared with connected user
async fn get_shared_repositories(State(ctx): State<Arc<AppCtx>>, request: Request) -> impl IntoResponse {
    let user = require_connected_user!(request);
    Ok(Json(DbRepository::shared_with(&ctx.database, user.id()).await?))
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
        deleted_ids.push(repository.clone());
    }
    Ok(Json(deleted_ids))
}

/// Get all root items of a repository
pub async fn root_content(State(ctx): State<Arc<AppCtx>>, request: axum::http::Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let permission = Permissions::new(&request)?;

    let data = Json::<Vec<RepositoryId>>::from_request(request, &ctx).await?;

    let mut result = vec![];
    for repository in data.0 {
        permission.view_repository(&ctx.database, &repository).await?.require()?;
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
        permission.edit_repository(&ctx.database, &repository).await?.require()?;
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
        if permissions.edit_repository(&ctx.database, &data.id).await?.granted() {
            if let Ok(mut repository) = DbRepository::from_id(&ctx.database, &data.id).await {
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
    permissions.view_repository(&ctx.database, repository.id()).await?.require()?;

    let mut zip = AsyncDirectoryZip::new();
    for item in DbItem::from_repository(&ctx.database, &RepositoryId::from(id), Trash::No).await? {
        zip.push_item(&ctx.database, item).await?;
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
    permissions.edit_repository(&ctx.database, &data.repository).await?.require()?;
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
    permissions.edit_repository(&ctx.database, &data.repository).await?.require()?;
    for user in &data.users {
        Subscription::find(&ctx.database, user, &data.repository).await?.delete(&ctx.database).await?;
    }
    Ok(())
}

/// Get all users subscribed to a repository
async fn subscriptions(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let data = Json::<RepositoryId>::from_request(request, &ctx).await?.0;
    permissions.edit_repository(&ctx.database, &data).await?.require()?;
    Ok(Json(Subscription::from_repository(&ctx.database, &data).await?))
}

/// Get repository stats
async fn stats(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let permissions = Permissions::new(&request)?;
    let data = Json::<RepositoryId>::from_request(request, &ctx).await?.0;
    permissions.edit_repository(&ctx.database, &data).await?.require()?;
    Ok(Json(DbRepository::stats(&DbRepository::from_id(&ctx.database, &data).await?, &ctx.database).await?))
}