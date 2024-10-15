use std::sync::Arc;
use anyhow::Error;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::response::IntoResponse;
use axum::Router;
use tracing::warn;
use types::item::Item;
use types::repository::Repository;
use types::user::User;
use crate::app_ctx::AppCtx;
use crate::route_item::ItemRoutes;
use crate::route_repository::RepositoryRoutes;
use crate::route_user::UserRoutes;

mod route_repository;
mod route_item;
mod route_user;
mod permissions;
mod upload;
pub mod app_ctx;

#[macro_export]
macro_rules! get_connected_user {
    ($request:expr, $prop:ident, $body:expr, $or_else:expr) => {{
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.connected_user().await.as_ref() {
            {$body}
        } else {
            $or_else
        }
    }};

    ($request:expr, $prop:ident, $body:expr) => (
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.connected_user().await.as_ref() {
            $body
        }
    );
}

#[macro_export]
macro_rules! require_connected_user {
    ($request:expr) => {{
        crate::get_connected_user!($request, connected_user, {
            connected_user.clone()
        }, {
            return Err(ServerError::msg(axum::http::StatusCode::UNAUTHORIZED, "Not connected"))
        })
    }};
}


#[macro_export]
macro_rules! get_display_repository {
    ($request:expr, $prop:ident, $body:expr, $or_else:expr) => {{
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.display_repository().await.as_ref() {
            {$body}
        } else {
            $or_else
        }
    }};

    ($request:expr, $prop:ident, $body:expr) => (
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.display_repository().await.as_ref() {
            $body
        }
    );
}

#[macro_export]
macro_rules! get_display_user {
    ($request:expr, $prop:ident, $body:expr, $or_else:expr) => {{
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.display_user().await.as_ref() {
            {$body}
        } else {
            $or_else
        }
    }};

    ($request:expr, $prop:ident, $body:expr) => (
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.display_user().await.as_ref() {
            $body
        }
    );
}

#[macro_export]
macro_rules! get_display_item {
    ($request:expr, $prop:ident, $body:expr, $or_else:expr) => {{
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.display_item().await.as_ref() {
            {$body}
        } else {
            $or_else
        }
    }};

    ($request:expr, $prop:ident, $body:expr) => (
        let req_ctx = $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap();
        if let Some($prop) = req_ctx.display_item().await.as_ref() {
            $body
        }
    );
}

#[macro_export]
macro_rules! require_display_repository {
    ($request:expr) => {{
        crate::get_display_repository!($request, display_directory, {
            display_directory.clone()
        }, {
            return Err(ServerError::msg(StatusCode::UNAUTHORIZED, "Invalid repository"))
        })
    }};
}

#[macro_export]
macro_rules! get_action {
    ($request:expr) => (
        $request.extensions().get::<std::sync::Arc<crate::RequestContext>>().unwrap().action().await
    );
}

#[derive(Default, Debug)]
pub struct RequestContext {
    pub connected_user: tokio::sync::RwLock<Option<User>>,
    pub display_user: tokio::sync::RwLock<Option<User>>,
    pub display_repository: tokio::sync::RwLock<Option<Repository>>,
    pub display_item: tokio::sync::RwLock<Option<Item>>,
    pub action: tokio::sync::RwLock<Option<String>>,
}

impl RequestContext {
    pub async fn connected_user(&self) -> tokio::sync::RwLockReadGuard<Option<User>> {
        self.connected_user.read().await
    }
    pub async fn connected_user_mut(&self) -> tokio::sync::RwLockWriteGuard<Option<User>> {
        self.connected_user.write().await
    }

    pub async fn display_user(&self) -> tokio::sync::RwLockReadGuard<Option<User>> {
        self.display_user.read().await
    }
    pub async fn display_user_mut(&self) -> tokio::sync::RwLockWriteGuard<Option<User>> {
        self.display_user.write().await
    }

    pub async fn display_repository(&self) -> tokio::sync::RwLockReadGuard<Option<Repository>> {
        self.display_repository.read().await
    }
    pub async fn display_repository_mut(&self) -> tokio::sync::RwLockWriteGuard<Option<Repository>> {
        self.display_repository.write().await
    }

    pub async fn display_item(&self) -> tokio::sync::RwLockReadGuard<Option<Item>> {
        self.display_item.read().await
    }
    pub async fn display_item_mut(&self) -> tokio::sync::RwLockWriteGuard<Option<Item>> {
        self.display_item.write().await
    }

    pub async fn action(&self) -> Option<String> {
        self.action.read().await.clone()
    }
}

pub struct RootRoutes {}

impl RootRoutes {
    pub fn create(ctx: &Arc<AppCtx>) -> Result<Router<>, Error> {
        let router = Router::new()
            .nest("/repository/", RepositoryRoutes::create(ctx)?)
            .nest("/user/", UserRoutes::router(ctx)?)
            .nest("/item/", ItemRoutes::create(ctx)?)
            .fallback(handler_404);
        Ok(router)
    }
}

async fn handler_404(_: Request<Body>) -> impl IntoResponse {
    warn!("\t\t'-> 404 : NOT FOUND");
    (StatusCode::NOT_FOUND, "Not found !")
}
