use std::fs;
use std::str::FromStr;
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
use tracing::{info, warn};
use database::item::DbItem;
use database::item::Trash::Both;
use types::database_ids::{DatabaseId, ObjectId};
use types::user::UserRole;
use utils::server_error::ServerError;

pub struct StatisticsRoutes;
impl StatisticsRoutes {
    pub fn router(ctx: &Arc<AppCtx>) -> Result<Router, Error> {
        let router = Router::new()
            .route("/recalculate-db-sizes", get(recalculate_db_sizes).with_state(ctx.clone()))
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


/// Get user data by id
async fn recalculate_db_sizes(State(ctx): State<Arc<AppCtx>>, request: Request<Body>) -> Result<impl IntoResponse, ServerError> {
    let user = require_connected_user!(request);
    if let UserRole::Admin = user.user_role {
        let files = fs::read_dir(&ctx.config.backend_config.file_storage_path)?;
        let mut found_objects = 0;
        for file in files {
            found_objects += 1;
            let entry = file?;
            let file_name = entry.file_name().to_str().unwrap().to_string();
            let object_id = ObjectId::from(DatabaseId::from_str(file_name.as_str())?);

            let items = match DbItem::from_object(&ctx.database, &object_id, Both).await {
                Ok(item) => {
                    if item.len() == 0 {
                        warn!("Object {} isn't attached to any item", object_id);
                    }
                    item
                }
                Err(err) => {
                    warn!("Failed to find items from object {object_id} : {}", err);
                    continue;
                }
            };

            for mut item in items {
                let item_cpy = item.clone();
                if let Some(file) = &mut item.file {
                    let entry_size = entry.metadata()?.len();
                    if file.size as u64 != entry_size {
                        warn!("Invalid file size for item {} ({}) Object is {}b vs {}b", item_cpy.id(), &item_cpy.absolute_path.plain()?, &entry_size, &file.size);

                        file.size = entry_size as i64;
                        DbItem::push(&mut item, &ctx.database).await?;
                        info!("Object size updated !");
                    }
                } else {
                    warn!("Item {} attached to object {object_id} doesn't have any file data", item.id());
                }
            }
        }

        info!("Finished cleanup pass for {found_objects} objects !");

        Ok(format!("Handled {found_objects} objects"))
    } else {
        Err(ServerError::msg(StatusCode::FORBIDDEN, "Access denied"))
    }
}