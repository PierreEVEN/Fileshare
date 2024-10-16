mod static_file_server;

use std::{env, fs};
use std::collections::VecDeque;
use std::process::{Stdio};
use std::sync::Arc;
use anyhow::Error;
use axum::body::Body;
use axum::extract::{Path, Request, State};
use axum::http::{StatusCode};
use axum::middleware::Next;
use axum::response::{Html, IntoResponse, Response};
use axum::{middleware, Json, Router};
use axum::routing::{get};
use serde::{Deserialize, Serialize};
use tokio::process::{Child, Command};
use tracing::{info};
use which::which;
use utils::config::WebClientConfig;
use api::{get_action, get_connected_user, get_display_item, get_display_repository, get_display_user, require_display_repository};
use api::app_ctx::AppCtx;
use database::item::{DbItem, Trash};
use api::RequestContext;
use database::repository::DbRepository;
use database::user::DbUser;
use types::database_ids::RepositoryId;
use types::enc_path::EncPath;
use types::enc_string::EncString;
use types::item::Item;
use types::repository::Repository;
use types::user::User;
use utils::server_error::ServerError;
use crate::static_file_server::StaticFileServer;

pub struct WebClient {
    _subcommand: Option<Child>,
}

impl WebClient {
    pub async fn new(config: &WebClientConfig) -> Result<Self, Error> {
        let base_directory = env::current_dir()?;
        let client = Self::try_create_client(config).await;
        env::set_current_dir(base_directory)?;
        client
    }

    async fn try_create_client(config: &WebClientConfig) -> Result<Self, Error> {
        if config.build_webpack {
            env::set_current_dir(&config.client_path)?;

            let result = which("node").or(Err(Error::msg("Failed to find node path. Please ensure nodejs is correctly installed")))?;
            let npm_cli_path = result.parent().unwrap().join("node_modules").join("npm").join("bin").join("npm-cli.js");

            if config.check_for_packages_updates {
                info!("Installing webclient dependencies...");
                let mut install_cmd = Command::new("node")
                    .arg(npm_cli_path.to_str().unwrap())
                    .arg("install")
                    .stderr(Stdio::inherit())
                    .stdout(Stdio::inherit())
                    .spawn()?;
                install_cmd.wait().await?;
                info!("Installed webclient dependencies !");
            }

            let command = if config.debug
            {
                Command::new("node")
                    .arg(npm_cli_path.to_str().unwrap())
                    .arg("run")
                    .arg("dev")
                    .stderr(Stdio::inherit())
                    .stdout(Stdio::inherit())
                    .spawn()?
            } else {
                Command::new("node")
                    .arg(npm_cli_path.to_str().unwrap())
                    .arg("run")
                    .arg("prod")
                    .stderr(Stdio::inherit())
                    .stdout(Stdio::inherit())
                    .spawn()?
            };

            Ok(Self { _subcommand: Some(command) })
        } else {
            Ok(Self { _subcommand: None })
        }
    }

    pub fn router(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        Ok(Router::new()
            .route("/", get(get_index).with_state(ctx.clone()))
            .route("/:display_user/", get(get_index).with_state(ctx.clone()))
            .route("/:display_user/:display_repository/", get(get_index).with_state(ctx.clone()))
            .route("/:display_user/:display_repository/*path", get(get_index).with_state(ctx.clone()))
            .route("/:display_user/:display_repository/api-link/", get(link).with_state(ctx.clone()))
            .route("/favicon.ico", get(Self::get_favicon).with_state(ctx.clone()))
            .nest("/public/", StaticFileServer::router(ctx.config.web_client_config.client_path.join("public")))
            .layer(middleware::from_fn_with_state(ctx.clone(), middleware_get_path_context))
        )
    }

    async fn get_favicon(State(ctx): State<Arc<AppCtx>>) -> Result<impl IntoResponse, ServerError> {
        StaticFileServer::serve_file_from_path(ctx.config.web_client_config.client_path.join("public").join("images").join("icons").join("favicon.ico")).await
    }
}

#[derive(Deserialize, Debug)]
pub struct PathData {
    display_user: Option<String>,
    display_repository: Option<String>,
}

pub async fn middleware_get_path_context(State(ctx): State<Arc<AppCtx>>, Path(PathData { display_user, display_repository }): Path<PathData>, request: axum::http::Request<Body>, next: Next) -> Result<Response, ServerError> {
    let context = request.extensions().get::<Arc<RequestContext>>().unwrap();
    if let Some(display_user) = display_user {
        if let Ok(display_user) = DbUser::from_url_name(&ctx.database, &EncString::from_url_path(display_user.clone())?).await {
            *context.display_user.write().await = Some(display_user);
        } else {
            return Err(ServerError::msg(StatusCode::NOT_FOUND, format!("Unknown user '{}'", display_user)));
        }
    }

    let mut repository_id = None;
    if let Some(display_repository) = display_repository {
        if let Ok(display_repository) = DbRepository::from_url_name(&ctx.database, &EncString::from_url_path(display_repository.clone())?).await {
            repository_id = Some(display_repository.id().clone());
            *context.display_repository.write().await = Some(display_repository);
        } else {
            return Err(ServerError::msg(StatusCode::NOT_FOUND, format!("Unknown repository '{}'", display_repository)));
        }
    }

    if let Some(repository) = repository_id {
        let mut path: VecDeque<&str> = request.uri().path().split("/").filter(|&x| !x.is_empty()).collect();
        if path.len() >= 3 {
            path.pop_front().ok_or(Error::msg("Expected user in path"))?;
            path.pop_front().ok_or(Error::msg("Expected repository in path"))?;
            let action = path.pop_front().ok_or(Error::msg("Expected action in path"))?;
            *context.action.write().await = Some(action.into());

            if !path.is_empty() {
                let mut enc_path = vec![];
                for item in path {
                    enc_path.push(EncString::from_url_path(item.to_string())?);
                }

                let item = DbItem::from_path(&ctx.database, &EncPath::from(enc_path), &repository, Trash::Both).await?;
                *context.display_item.write().await = Some(item);
            }
        }
    }

    Ok(next.run(request).await)
}

#[derive(Serialize, Default)]
struct ClientAppConfig {
    pub origin: String,
    pub connected_user: Option<User>,
    pub display_user: Option<User>,
    pub display_repository: Option<Repository>,
    pub display_item: Option<Item>,
    pub in_trash: bool,
    pub repository_settings: bool,
}

fn get_origin(ctx: &Arc<AppCtx>, request: &Request) -> Result<String, ServerError> {
    let use_https = if let Some(scheme) = request.uri().scheme_str() { scheme == "https" } else { ctx.config.use_tls || ctx.config.web_client_config.force_secure_requests };

    println!("request : {:?} {:?} {:?} {:?}", request.uri(), request.uri().host(), request.uri().authority(), request.uri().scheme_str());
    Ok(format!("{}://{}", if use_https { "https" } else { "http" }, match request.headers().get("host") {
        None => {
            match request.uri().host() {
                None => { ctx.config.addresses[0].to_string() }
                Some(host) => {
                    match request.uri().port() {
                        None => { ctx.config.addresses[0].to_string() }
                        Some(port) => { format!("{}:{}", host, port.as_str()) }
                    }
                }
            }
        }
        Some(host) => { host.to_str()?.to_string() }
    }))
}


async fn get_index(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    let mut client_config = ClientAppConfig {
        origin: get_origin(&ctx, &request)?,
        ..Default::default()
    };

    get_connected_user!(request, user, {
        client_config.connected_user = Some(user.clone());
    });
    get_display_user!(request, user, {
        client_config.display_user = Some(user.clone());
    });
    get_display_repository!(request, repository, {
        client_config.display_repository = Some(repository.clone());
    });
    get_display_item!(request, item, {
        client_config.display_item = Some(item.clone());
    });

    if let Some(action) = get_action!(request) {
        client_config.in_trash = action == "trash";
        client_config.repository_settings = action == "settings";
    }

    let index_path_buf = ctx.config.web_client_config.client_path.join("public").join("index.html");
    let index_path = index_path_buf.to_str().unwrap();
    let index_data = match fs::read_to_string(index_path) {
        Ok(file) => { file }
        Err(err) => { Err(Error::msg(format!("Cannot find index file : {err} (searching in {index_path})")))? }
    };
    let index_data = index_data.replace(r#"data-app_config='{}'"#, format!(r##"data-app_config='{}'"##, serde_json::to_string(&client_config)?).as_str());
    Ok(Html(index_data))
}

async fn link(State(ctx): State<Arc<AppCtx>>, request: Request) -> Result<impl IntoResponse, ServerError> {
    #[derive(Serialize)]
    struct Response {
        origin: String,
        id: RepositoryId,
    }
    let repository = require_display_repository!(request);
    let response = Response {
        origin: get_origin(&ctx, &request)?,
        id: repository.id().clone(),
    };
    Ok(Json(response))
}