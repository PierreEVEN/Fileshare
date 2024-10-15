use anyhow::Error;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct PostgresConfig {
    pub username: String,
    pub secret: String,
    pub url: String,
    pub port: u16,
    pub database: String,
    pub ssl_mode: bool,
    pub scheme_name: String
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct WebClientConfig {
    pub client_path: PathBuf,
    pub debug: bool,
    pub check_for_packages_updates: bool,
    pub build_webpack: bool
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct ServiceEmailConfig {
    pub host: String,
    pub smtp_port: String,
    pub email_username: String,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct TlsConfig {
    pub certificate: PathBuf,
    pub private_key: PathBuf,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct BackendConfig {
    pub file_storage_path: PathBuf,
    pub thumbnail_storage_path: PathBuf,
    pub thumbnail_size: usize,
    pub max_parallel_task: usize,
    pub postgres: PostgresConfig,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Config {
    pub addresses: Vec<String>,
    pub backend_config: BackendConfig,
    pub server_mail_server: ServiceEmailConfig,
    pub web_client_config: WebClientConfig,
    pub tls_config: TlsConfig,
    pub use_tls: bool,
    pub admin_user_name: Option<String>
}

impl Default for Config {
    fn default() -> Self {
        Self {
            addresses: vec!["127.0.0.1:3000".to_string()],
            backend_config: BackendConfig {
                file_storage_path: PathBuf::from("data").join("files"),
                thumbnail_storage_path: PathBuf::from("data").join("thumbnails"),
                thumbnail_size: 100,
                max_parallel_task: 0,
                postgres: PostgresConfig {
                    username: "postgres".to_string(),
                    secret: "password".to_string(),
                    url: "127.0.0.1".to_string(),
                    port: 5432,
                    database: "postgres".to_string(),
                    ssl_mode: false,
                    scheme_name: "fileshare_v3".to_string()
                },
            },
            server_mail_server: ServiceEmailConfig {
                host: "mail.fileshare.fr".to_string(),
                smtp_port: "465".to_string(),
                email_username: "noreply@fileshare.fr".to_string(),
            },
            web_client_config: WebClientConfig {
                client_path: PathBuf::from("./web_client"),
                debug: false,
                check_for_packages_updates: true,
                build_webpack: true,
            },
            tls_config: TlsConfig {
                certificate: PathBuf::from("/Path/To/certificate.pem"),
                private_key: PathBuf::from("/Path/To/private_key.pem"),
            },
            use_tls: true,
            admin_user_name: Some(String::from("admin")),
        }
    }
}

impl Config {
    pub fn from_file(path: PathBuf) -> Result<Self, Error> {
        if path.exists() {
            Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
        }
        else {
            fs::write(path.clone(), serde_json::to_string_pretty(&Config::default())?)?;
            Err(Error::msg("Created a new config file. Please fill in information first"))
        }
    }
}
