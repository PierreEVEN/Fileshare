mod logger;

use std::{env, fs};
use std::net::{SocketAddr};
use std::str::FromStr;
use std::sync::Arc;
use std::sync::atomic::Ordering::SeqCst;
use std::time::Instant;
use axum::{middleware, Router};
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{Html, IntoResponse, Response};
use axum_extra::extract::CookieJar;
use axum_server::tls_rustls::RustlsConfig;
use axum_server_dual_protocol::{tokio, ServerExt};
use tracing::{error, info, trace, warn};
use http_body_util::BodyExt;
use api::app_ctx::AppCtx;
use api::{RequestContext, RootRoutes};
use client_web::WebClient;
use database::upgrades::compatibility_upgrade::Upgrade;
use database::upgrades::fix_encoded_strings::FixEncodedStrings;
use database::upgrades::rehash_files::RehashFiles;
use database::user::DbUser;
use serde::Serialize;
use types::enc_string::EncString;
use utils::config::{Config, WebClientConfig};
use utils::server_error::ServerError;
use crate::logger::init_logger;

async fn start_web_client(config: WebClientConfig) {
    match WebClient::new(&config).await {
        Ok(_) => { info!("Successfully started web client.") }
        Err(err) => {
            error!("Failed to start web client : {err}");
        }
    };
}

#[derive(Default)]
struct Server {
    listeners: Vec<SocketAddr>,
}

impl Server {
    pub fn add_listener(&mut self, addr: SocketAddr) {
        self.listeners.push(addr);
    }

    pub async fn start(&self, config: &Config, router: Router) {
        let mut spawned_threads = vec![];

        let tls_config = if config.use_tls {
            if !config.tls_config.certificate.exists() || !config.tls_config.private_key.exists() {
                error!("Invalid tls certificate paths : cert:'{}' / key:'{}'", config.tls_config.certificate.display(), config.tls_config.private_key.display());
                return;
            }

            Some(match RustlsConfig::from_pem_file(config.tls_config.certificate.clone(), config.tls_config.private_key.clone()).await {
                Ok(config) => { config }
                Err(err) => {
                    error!("Invalid tls configuration : {err}");
                    return;
                }
            })
        } else {
            None
        };

        for addr in self.listeners.clone() {
            let router = router.clone();
            let tls_config = tls_config.clone();
            spawned_threads.push(tokio::spawn(async move {
                if let Some(tls_config) = &tls_config {
                    match axum_server_dual_protocol::bind_dual_protocol(addr, tls_config.clone())
                        .set_upgrade(true)
                        .serve(router.into_make_service())
                        .await {
                        Ok(_) => {}
                        Err(err) => {
                            error!("Cannot start secured web server : {err}");
                        }
                    };
                } else {
                    axum::serve(match tokio::net::TcpListener::bind(addr).await {
                        Ok(listener) => { listener }
                        Err(error) => {
                            error!("Cannot start unsecured web server : {error}");
                            return;
                        }
                    }, router).await.unwrap();
                }
            }))
        }

        for thread in spawned_threads {
            match thread.await {
                Ok(_) => {}
                Err(err) => { error!("Server thread ended : {err}") }
            };
        }
    }
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
    init_logger();

    // Open Config
    let config = match Config::from_file(env::current_exe().expect("Failed to find executable path").parent().unwrap().join("config.json")) {
        Ok(config) => { config }
        Err(error) => {
            error!("Failed to load config : {}", error);
            return;
        }
    };

    let ctx = Arc::new(match AppCtx::new(config.clone()).await {
        Ok(ctx) => { ctx }
        Err(error) => {
            error!("Failed to load app context : {error}");
            return;
        }
    });

    /*********************** READ ARGS  ***********************/
    if env::args().len() > 0 {
        let mut upgrade = false;
        let mut fix_encoded_strings = false;
        let mut rehash_files = false;
        let mut upgrade_schema = None;
        for arg in env::args() {
            if upgrade {
                upgrade_schema = Some(arg);
                upgrade = false;
            } else if arg == "--upgrade" {
                upgrade = true;
            } else if arg == "--fix-encoded-strings" {
                fix_encoded_strings = true;
            } else if arg == "--rehash-files" {
                rehash_files = true;
            }
        }
        if let Some(upgrade_schema) = upgrade_schema {
            info!("Upgrading from old schema {upgrade_schema}");
            match Upgrade::run(&ctx.database, &upgrade_schema).await {
                Ok(_) => {
                    info!("Successfully upgraded database from {upgrade_schema}");
                    return;
                }
                Err(err) => {
                    error!("Failed to upgrade database : {err}");
                    return;
                }
            };
        }
        if fix_encoded_strings {
            match FixEncodedStrings::run(&ctx.database).await {
                Ok(_) => {
                    info!("Successfully fixed encoded string");
                    return;
                }
                Err(err) => {
                    error!("Failed to fix encoded strings : {err}");
                    return;
                }
            };
        }
        if rehash_files {
            match RehashFiles::run(&ctx.database).await {
                Ok(_) => {
                    info!("Successfully rehashed files");
                    return;
                }
                Err(err) => {
                    error!("Failed to rehash files : {err}");
                    return;
                }
            };
        }
    }

    // Start web client
    start_web_client(config.web_client_config.clone()).await;

    // Instantiate router
    let router = Router::new()
        .nest("/api", RootRoutes::create(&ctx).unwrap())
        .merge(WebClient::router(&ctx).unwrap())
        .layer(middleware::from_fn(middleware_remove_trailing_slash))
        .layer(middleware::from_fn_with_state(ctx.clone(), print_request_response))
        .layer(middleware::from_fn_with_state(ctx.clone(), middleware_get_request_context));

    // Create http server
    let mut server = Server::default();
    for address in &config.addresses {
        match SocketAddr::from_str(address.as_str()) {
            Ok(addr) => { server.add_listener(addr); }
            Err(err) => { error!("Invalid server address '{}' : {err}", address); }
        };
    }
    server.start(&ctx.config, router).await;

    info!("Server closed !");
}

pub async fn middleware_get_request_context(jar: CookieJar, State(ctx): State<Arc<AppCtx>>, mut request: Request<Body>, next: Next) -> Result<Response, ServerError> {
    let mut context = RequestContext::default();

    let token = match jar.get("authtoken") {
        None => { request.headers().get("content-authtoken").map(EncString::try_from) }
        Some(token) => { Some(EncString::from_url_path(token.value().to_string())) }
    };

    if let Some(token) = token {
        context.connected_user = tokio::sync::RwLock::new(match DbUser::from_auth_token(&ctx.database, &token?).await {
            Ok(connected_user) => { Some(connected_user) }
            Err(_) => { None }
        })
    }

    let uri = request.uri().clone();
    let user_string = if let Some(user) = &*context.connected_user().await {
        format!("#{}", user.name)
    } else { String::from("{?}") };
    info!("[{}] {} | {}", request.method(), user_string, uri);
    request.extensions_mut().insert(Arc::new(context));
    Ok(next.run(request).await)
}

pub async fn middleware_remove_trailing_slash(mut request: Request<Body>, next: Next) -> Result<impl IntoResponse, ServerError> {
    let uri = request.uri_mut();
    let path_str = uri.path();
    if path_str.ends_with('/') && path_str.len() > 1 {
        return Ok(axum::response::Redirect::to(&path_str[..path_str.len() - 1]).into_response());
    }
    Ok(next.run(request).await)
}

async fn print_request_response(State(ctx): State<Arc<AppCtx>>, req: Request<Body>, next: Next) -> Result<impl IntoResponse, impl IntoResponse> {
    let path = req.uri().path().to_string();
    let origin = client_web::get_origin(&ctx, &req)?;

    let start = Instant::now();

    // Retrieve the request context object
    let context = match req.extensions().get::<Arc<RequestContext>>() {
        None => { None }
        Some(context) => { Some(context.clone()) }
    };

    // Execute the request and get the response
    let mut res = next.run(req).await;

    if !res.status().is_success() {

        // Get response message
        let (parts, body) = res.into_parts();
        let bytes = match buffer_and_print("response", body).await {
            Ok(res) => { res }
            Err((code, msg)) => { return Err(ServerError::msg(code, msg)) }
        };
        let data_string = match String::from_utf8(bytes.as_ref().to_vec()) {
            Ok(data) => { data }
            Err(err) => {
                error!("Failed to convert body to string : {}", err);
                return Ok(Response::from_parts(parts, Body::from(bytes)));
            }
        };

        warn!("{} ({}) : {}", parts.status, path, data_string);
        // Embed the response into a html webpage if it was sent from a web client
        if let Some(context) = context {
            if context.is_web_client.load(SeqCst) {
                let index_path_buf = ctx.config.web_client_config.client_path.join("public").join("index.html");
                let index_path = index_path_buf.to_str().unwrap();
                let index_data = match fs::read_to_string(index_path) {
                    Ok(file) => { file }
                    Err(err) => { return Err(ServerError::msg(StatusCode::INTERNAL_SERVER_ERROR, format!("Cannot find index file : {err} (searching in {index_path})"))) }
                };

                #[derive(Serialize, Default)]
                struct ErrorInfos {
                    origin: String,
                    error_message: String,
                    error_code: String,
                }
                let infos = ErrorInfos {
                    origin,
                    error_message: data_string,
                    error_code: parts.status.to_string(),
                };

                let index_data = index_data.replace(r#"data-app_config='{}'"#, format!(r##"data-app_config='{}'"##, match serde_json::to_string(&infos) {
                    Ok(data) => { data.replace("'", "&apos;") }
                    Err(err) => { return Err(ServerError::msg(StatusCode::INTERNAL_SERVER_ERROR, err.to_string())) }
                }).as_str());

                trace!("REQUEST ({:2?}) - {}", start.elapsed(), path);
                return Ok(Html(index_data).into_response());
            }
        }

        res = Response::from_parts(parts, Body::from(bytes));
    }
    trace!("REQUEST ({:2?}) - {}", start.elapsed(), path);
    Ok(res)
}

async fn buffer_and_print<B>(direction: &str, body: B) -> Result<Bytes, (StatusCode, String)>
where
    B: axum::body::HttpBody<Data=Bytes>,
    B::Error: std::fmt::Display,
{
    let bytes = match body.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(err) => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("failed to read {direction} body: {err}"),
            ));
        }
    };
    Ok(bytes)
}