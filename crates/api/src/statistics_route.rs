use crate::app_ctx::AppCtx;
use crate::require_connected_user;
use anyhow::Error;
use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use std::sync::Arc;
use types::user::UserRole;
use utils::server_error::ServerError;

pub struct StatisticsRoutes;
impl StatisticsRoutes {
    pub fn router(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        let router = Router::new()
            .route("/", get(get_stats).with_state(ctx.clone()));
        Ok(router)
    }
}

/// Get user data by id
async fn get_stats(State(ctx): State<Arc<AppCtx>>, request: Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let user = require_connected_user!(request);
    if let UserRole::Admin = user.user_role {
        Ok(Json(ctx.statistics.read()))
    } else {
        Err(ServerError::msg(StatusCode::FORBIDDEN, "Access denied"))
    }
}
