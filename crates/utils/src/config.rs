use anyhow::Error;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use serde_inline_default::serde_inline_default;

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PostgresConfig {
    #[serde_inline_default("postgres".to_string())]
    pub username: String,

    #[serde_inline_default("password".to_string())]
    pub secret: String,

    #[serde_inline_default("127.0.0.1".to_string())]
    pub url: String,

    #[serde_inline_default(5432)]
    pub port: u16,

    #[serde_inline_default("postgres".to_string())]
    pub database: String,

    #[serde_inline_default(false)]
    pub ssl_mode: bool,

    #[serde_inline_default("fileshare_v3".to_string())]
    pub scheme_name: String,
}

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EMailerConfig {
    #[serde_inline_default("noreply@fileshare.com".to_string())]
    pub source_address: String,
    #[serde_inline_default("mail.fileshare.com".to_string())]
    pub smtp_server: String,
    #[serde_inline_default(None)]
    pub smtp_auth: Option<(String, String)>,
}

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VideoServerConfig {
    #[serde_inline_default(PathBuf::from("data").join("streaming_cache"))]
    pub cache_path: PathBuf,

    #[serde_inline_default(Duration::from_secs(24 * 3600))] // 24h
    pub stream_ttl: Duration,

    #[serde_inline_default(Duration::from_secs(10))]
    pub max_request_timout: Duration,

    #[serde_inline_default(10000)]
    pub tick_interval_ms: u64,

    #[serde_inline_default(5)]
    pub segment_duration_sec: u32,
}

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WebClientConfig {
    #[serde_inline_default(PathBuf::from("./web_client"))]
    pub client_path: PathBuf,

    #[serde_inline_default(false)]
    pub debug: bool,

    #[serde_inline_default(true)]
    pub check_for_packages_updates: bool,

    #[serde_inline_default(true)]
    pub build_webpack: bool,

    #[serde_inline_default(false)]
    pub force_secure_requests: bool,
}

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TlsConfig {
    #[serde_inline_default(PathBuf::from("/Path/To/certificate.pem"))]
    pub certificate: PathBuf,

    #[serde_inline_default(PathBuf::from("/Path/To/private_key.pem"))]
    pub private_key: PathBuf,
}

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackendConfig {
    #[serde_inline_default(PathBuf::from("data").join("files"))]
    pub file_storage_path: PathBuf,

    #[serde_inline_default(PathBuf::from("data").join("cache"))]
    pub static_cache_storage_path: PathBuf,

    #[serde_inline_default(100)]
    pub thumbnail_size: usize,

    #[serde_inline_default(5)]
    pub thumbnail_processes: usize,

    #[serde_inline_default(make_default_config::<VideoServerConfig>())]
    pub video_server: VideoServerConfig,

    #[serde_inline_default(make_default_config::<PostgresConfig>())]
    pub postgres: PostgresConfig,

    #[serde_inline_default(make_default_config::<EMailerConfig>())]
    pub emailer: EMailerConfig,
}

#[serde_inline_default]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Config {
    #[serde_inline_default(vec!["127.0.0.1:3000".to_string()])]
    pub addresses: Vec<String>,

    #[serde_inline_default(make_default_config::<BackendConfig>())]
    pub backend_config: BackendConfig,

    #[serde_inline_default(make_default_config::<WebClientConfig>())]
    pub web_client_config: WebClientConfig,

    #[serde_inline_default(make_default_config::<TlsConfig>())]
    pub tls_config: TlsConfig,

    #[serde_inline_default(true)]
    pub use_tls: bool,

    #[serde_inline_default(Some(String::from("admin")))]
    pub admin_user_name: Option<String>,
}

fn make_default_config<'a, T: 'static + Deserialize<'a>>() -> T {
    serde_json::from_str::<T>("{}").unwrap()
}

impl Config {
    pub fn from_file(path: PathBuf) -> Result<Self, Error> {
        if path.exists() {
            Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
        } else {
            fs::write(
                path.clone(),
                serde_json::to_string_pretty(&make_default_config::<Config>())?,
            )?;
            Err(Error::msg(
                "Created a new config file. Please fill in information first",
            ))
        }
    }
}
