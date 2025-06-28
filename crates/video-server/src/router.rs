use axum::{Error, Router};
use axum::routing::{get, post};

pub struct VideoServerRouter {

}

impl VideoServerRouter {
    pub fn create() -> Result<Router, Error> {
        Ok(Router::new()
            .route("/video/:stream_id/manifest", get(return_virtual_manifest))
            .route("/video/:stream_id/manifest.mpd", get(return_manifest))
            .route("/video/:stream_id/data/init.mp4", get(get_init))
            .route("/video/:stream_id/kill", post(kill))
            .route("/video/:stream_id/data/stream.vtt", get(get_subtitle))
            .route("/video/:stream_id/data/stream.ass", get(get_subtitle_ass))
            .route("/video/:stream_id/data/*chunk", get(get_chunk))
        )
    }
}