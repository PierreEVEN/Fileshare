use std::{env};
use std::net::{SocketAddr};
use std::str::FromStr;
use std::sync::Arc;
use axum::{middleware, Router};
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum_extra::extract::CookieJar;
use axum_server::tls_rustls::RustlsConfig;
use axum_server_dual_protocol::{tokio, ServerExt};
use tracing::{error, info, warn};
use http_body_util::BodyExt;
use api::app_ctx::AppCtx;
use api::{RequestContext, RootRoutes};
use client_web::WebClient;
use database::upgrades::compatibility_upgrade::Upgrade;
use database::upgrades::fix_encoded_strings::FixEncodedStrings;
use database::upgrades::rehash_files::RehashFiles;
use database::user::DbUser;
use types::enc_string::EncString;
use utils::config::{Config, WebClientConfig};
use utils::server_error::ServerError;

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

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().init();

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

    start_web_client(config.web_client_config.clone()).await;

    // Start web client

    // Instantiate router
    let router = Router::new()
        .nest("/api/", RootRoutes::create(&ctx).unwrap())
        .nest("/", WebClient::router(&ctx).unwrap())
        .layer(middleware::from_fn_with_state(ctx.clone(), middleware_get_request_context))
        .layer(middleware::from_fn(print_request_response));

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
async fn print_request_response(req: Request<Body>, next: Next) -> Result<impl IntoResponse, (StatusCode, String)> {
    let path = req.uri().path().to_string();
    let mut res = next.run(req).await;
    if !res.status().is_success() {
        let (parts, body) = res.into_parts();
        let bytes = buffer_and_print("response", body).await?;
        let data_string = match String::from_utf8(bytes.as_ref().to_vec()) {
            Ok(data) => { data }
            Err(err) => {
                error!("Failed to convert body to string : {}", err);
                return Ok(Response::from_parts(parts, Body::from(bytes)));
            }
        };
        res = Response::from_parts(parts, Body::from(bytes));

        warn!("{} ({}) : {}", res.status().to_string(), path, data_string);
    }
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

    if let Ok(body) = std::str::from_utf8(&bytes) {
        tracing::debug!("{direction} body = {body:?}");
    }

    Ok(bytes)
}