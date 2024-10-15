use types::enc_string::EncString;
use utils::server_error::ServerError;
use crate::{get_connected_user, require_connected_user};
use anyhow::Error;
use axum::body::Body;
use axum::extract::{FromRequest, Path, State};
use axum::http::{Request, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::CookieJar;
use serde::{Deserialize};
use std::collections::HashSet;
use std::sync::Arc;
use tracing::log::info;
use database::repository::DbRepository;
use database::user::{DbAuthToken, DbUser};
use types::database_ids::{DatabaseId, PasswordHash, UserId};
use types::repository::RepositoryStatus;
use types::user::{AuthToken, LoginInfos, LoginResult, User, UserRole};
use crate::app_ctx::AppCtx;

pub struct UserRoutes {}

impl UserRoutes {
    pub fn router(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        let router = Router::new()
            .route("/find/", post(find_users).with_state(ctx.clone()))
            .route("/login/", post(login).with_state(ctx.clone()))
            .route("/delete/", post(delete_user).with_state(ctx.clone()))
            .route("/logout/", post(logout).with_state(ctx.clone()))
            .route("/search/", post(search).with_state(ctx.clone()))
            .route("/tokens/", get(auth_tokens).with_state(ctx.clone()))
            .route("/update/", post(update).with_state(ctx.clone()))
            .route("/repositories/:user_id/", get(repositories).with_state(ctx.clone()))
            .route("/create/", post(create_user).with_state(ctx.clone()));

        Ok(router)
    }
}

/// Get user data by id
async fn find_users(State(ctx): State<Arc<AppCtx>>, Json(json): Json<Vec<UserId>>) -> Result<impl IntoResponse, ServerError> {
    let mut repositories = vec![];
    for repository in &json {
        repositories.push(DbUser::from_id(&ctx.database, repository).await?)
    }
    Ok(Json(repositories))
}


#[derive(Deserialize)]
struct CreateUserInfos {
    pub username: EncString,
    pub email: EncString,
    pub password: EncString,
}
/// Create a new account
async fn create_user(State(ctx): State<Arc<AppCtx>>, Json(payload): Json<CreateUserInfos>) -> Result<impl IntoResponse, ServerError> {
    let forbidden_usernames: HashSet<&str> = HashSet::from_iter(vec!["auth", "delete-user", "api", "public", "repositories"]);

    if forbidden_usernames.contains(payload.username.plain()?.as_str()) {
        Err(Error::msg("Forbidden username"))?
    }

    let url_name = payload.username.url_formated()?;

    if DbUser::from_url_name(&ctx.database, &url_name).await.is_ok() {
        return Ok((StatusCode::CONFLICT, "User already exists : duplicated url identifier !".to_string()));
    } else if DbUser::exists(&ctx.database, &payload.username, &payload.email).await? {
        return Ok((StatusCode::CONFLICT, "User already exists : duplicated logins !".to_string()));
    } else {
        let mut new_user = User::default();

        new_user.name = url_name;
        new_user.login = payload.username;
        new_user.email = payload.email;
        new_user.user_role = UserRole::Guest;

        if let Some(admin_user_name) = &ctx.config.admin_user_name {
            if new_user.login.plain()? == *admin_user_name && !DbUser::has_admin(&ctx.database).await? {
                new_user.user_role = UserRole::Admin;
                info!("Created default administrator")
            }
        }

        match DbUser::create_or_reset_password(&mut new_user, &ctx.database, &PasswordHash::new(&payload.password)?).await {
            Ok(_) => {}
            Err(err) => {
                return Ok((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user : {err}")))
            }
        };
    };

    Ok((StatusCode::OK, "Created new user".to_string()))
}

#[derive(Deserialize)]
pub struct UserCredentials {
    pub login: EncString,
    pub password: EncString,
}

/// Get authentication token
async fn login(State(ctx): State<Arc<AppCtx>>, Json(payload): Json<LoginInfos>) -> Result<impl IntoResponse, ServerError> {
    let user = DbUser::from_credentials(&ctx.database, &payload.login, &payload.password).await.map_err(|err| {ServerError::msg(StatusCode::UNAUTHORIZED, format!("{err}"))})?;
    let auth_token = DbUser::generate_auth_token(&user, &ctx.database, &match payload.device {
        None => { EncString::from("Unknown device") }
        Some(device) => { device }
    }).await?;

    Ok(Json(LoginResult {
        user,
        token: auth_token,
    }))
}

/// Get authentication tokens for current account
async fn auth_tokens(State(ctx): State<Arc<AppCtx>>, request: axum::http::Request<Body>) -> Result<Json<Vec<AuthToken>>, ServerError> {
    let connected_user = require_connected_user!(request);
    Ok(Json(DbAuthToken::from_user(&ctx.database, connected_user.id()).await?))
}

/// Remove current authentication token
async fn logout(jar: CookieJar, State(ctx): State<Arc<AppCtx>>, request: Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let token = match request.headers().get("content-authtoken").map(EncString::try_from) {
        None => { jar.get("authtoken").map(|token| EncString::from_url_path(token.value().to_string())) }
        Some(token) => { Some(token) }
    };

    match token {
        None => { Err(Error::msg("No token provided".to_string()))? }
        Some(authentication_token) => {
            let token = DbAuthToken::find(&ctx.database, &authentication_token?).await?;
            DbAuthToken::delete(&token, &ctx.database).await?;
            Ok((StatusCode::ACCEPTED, "Successfully disconnected user".to_string()))
        }
    }
}

/// Delete the user logged in
async fn delete_user(State(ctx): State<Arc<AppCtx>>, request: Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let connected_user = require_connected_user!(request);

    let data = Json::<UserCredentials>::from_request(request, &ctx).await?.0;
    let from_creds = DbUser::from_credentials(&ctx.database, &data.login, &data.password).await?;

    if *from_creds.id() != *connected_user.id() {
        return Err(Error::msg("Cannot delete someone else's account"))?;
    }

    DbUser::delete(&from_creds, &ctx.database).await?;
    Ok(())
}

/// Get the list of repositories of a given users
async fn repositories(State(ctx): State<Arc<AppCtx>>, Path(user_id): Path<DatabaseId>, request: Request<Body>) -> Result<impl IntoResponse, ServerError> {
    // If connected, get all
    get_connected_user!(request, user, {
        let desired_user = DbUser::from_id(&ctx.database, &UserId::from(user_id)).await?;
        if user.id() == desired_user.id() {
            let mut repositories = vec![];
            for repository in DbRepository::from_user(&ctx.database, user.id()).await? {
                repositories.push(repository.id().clone());
            }
            return Ok(Json(repositories))
        }
    });

    // Else only get public repositories
    let mut repositories = vec![];
    for repository in DbRepository::from_user(&ctx.database, &UserId::from(user_id)).await? {
        if let RepositoryStatus::Public = repository.status {
            repositories.push(repository.id().clone());
        }
    }
    Ok(Json(repositories))
}

/// Update user data
async fn update(State(ctx): State<Arc<AppCtx>>, request: axum::extract::Request) -> Result<impl IntoResponse, ServerError> {
    let mut user = require_connected_user!(request);

    #[derive(Deserialize, Debug)]
    struct Data {
        id: UserId,
        login: EncString,
        name: EncString,
        allow_contact: bool,
    }

    let json = Json::<Data>::from_request(request, &ctx).await?.0;

    if *user.id() != json.id {
        return Err(Error::msg("Cannot update information of someone else"))?;
    }

    user.login = json.login;
    user.name = json.name;
    user.allow_contact = json.allow_contact;
    DbUser::push(&mut user, &ctx.database).await?;

    Ok(())
}

/// Search user by name
async fn search(State(ctx): State<Arc<AppCtx>>, request: axum::extract::Request) -> Result<impl IntoResponse, ServerError> {
    #[derive(Deserialize, Debug)]
    struct Data {
        name: EncString,
        exact: bool
    }
    let json = Json::<Data>::from_request(request, &ctx).await?.0;
    let mut users = vec![];
    for user in DbUser::search(&ctx.database, &json.name, json.exact).await? {
        users.push(user.id().clone());
    }
    Ok(Json(users))
}