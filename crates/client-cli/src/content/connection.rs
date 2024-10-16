use std::{env, fs};
use std::io::{stdin, stdout, Write};
use anyhow::Error;
use gethostname::gethostname;
use paris::{error, success, warn};
use reqwest::Response;
use rpassword::read_password;
use serde_derive::{Deserialize, Serialize};
use types::database_ids::RepositoryId;
use types::enc_string::EncString;
use types::repository::Repository;
use types::user::{AuthToken, LoginInfos, LoginResult};
use crate::content::meta_dir::MetaDir;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Url {
    remote_id: RepositoryId,
    origin: String,
}

impl Url {
    pub fn parse(public_url: &str) -> Result<(String, String, String, String), Error> {
        let mut method = "";
        let repository_url = if public_url.starts_with("https") {
            method = "https://";
            &public_url[8..]
        } else if public_url.starts_with("http") {
            method = "http://";
            &public_url[7..]
        } else {
            public_url
        };
        let mut split = repository_url.split("/");
        let domain = split.next().ok_or(Error::msg("Invalid domain"))?;
        let user = split.next().ok_or(Error::msg("Invalid user"))?;
        let repository = split.next().ok_or(Error::msg("Invalid repository"))?;
        Ok((method.to_string(), domain.to_string(), user.to_string(), repository.to_string()))
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct Connection {
    authentication_token: Option<AuthToken>,
    url: Option<Url>,
    #[serde(skip_deserializing, skip_serializing)]
    meta_dir: MetaDir,
    #[serde(skip_deserializing, skip_serializing)]
    client: reqwest::Client,
}

impl Connection {
    pub fn new(meta_dir: MetaDir) -> Result<Self, Error> {
        let path = meta_dir.connection_config_path()?;

        let mut config = if path.exists() {
            serde_json::from_str(fs::read_to_string(path)?.as_str())?
        } else {
            Self::default()
        };
        config.meta_dir = meta_dir;
        Ok(config)
    }

    pub async fn ping_repository(&mut self) -> Result<Repository, Error> {
        let response = self.post("/repository/find/".to_string()).await?
            .json(&vec![self.remote_id()?])
            .send().await?;
        let repositories: Vec<Repository> = self.parse_result(response).await?.error_for_status()?.json().await?;
        if repositories.is_empty() {
            if self.authentication_token.is_some() {
                Err(Error::msg("Repository does not exists"))
            }
            else {
                self.authenticate(None).await?;
                Err(Error::msg("Please try again"))
            }
        } else {
            Ok(repositories[0].clone())
        }
    }

    pub async fn set_public_url(&mut self, public_url: &str) -> Result<(), Error> {
        let (method, domain, user, repository) = Url::parse(public_url)?;
        let response = self.client.get(format!("{}{}/{}/{}/api-link/", method, domain, user, repository))
            .send().await?;
        #[derive(Deserialize)]
        struct RemoteResponse {
            id: RepositoryId,
        }
        let response: RemoteResponse = self.parse_result(response).await?.error_for_status()?.json().await?;
        self.url = Some(Url {
            remote_id: response.id,
            origin: format!("{}{}", method, domain),
        });
        Ok(())
    }

    pub async fn authenticate(&mut self, username: Option<String>) -> Result<EncString, Error> {
        
        if self.authentication_token.is_some() {
            match self.logout().await {
                Ok(_) => {}
                Err(err) => {error!("Failed to log out before login : {}", err)}
            }
        }
        
        let mut body = LoginInfos {
            device: Some(EncString::from(format!("Cli client - {} ({}) : {}", gethostname().to_str().unwrap(), env::consts::OS, self.meta_dir.root()?.display()).as_str())),
            ..Default::default()
        };
        body.login = match username {
            None => {
                print!("Username or email : ");
                stdout().flush()?;
                let mut buffer = String::new();
                stdin().read_line(&mut buffer)?;
                if let Some('\n') = buffer.chars().next_back() {
                    buffer.pop();
                }
                if let Some('\r') = buffer.chars().next_back() {
                    buffer.pop();
                }
                EncString::from(buffer.as_str())
            }
            Some(username) => { EncString::from(username.as_str()) }
        };

        let url = if let Some(url) = &self.url {
            url
        } else { return Err(Error::msg("Remote url is not set !")) };

        for _ in 0..3 {
            print!("Password : ");
            stdout().flush()?;
            body.password = match read_password() {
                Ok(password) => { EncString::from(password) }
                Err(err) => {
                    return Err(Error::msg(err));
                }
            };
            let client = self.client.post(format!("{}/api/user/login/", url.origin))
                .json(&body)
                .send().await?;

            if client.status().as_u16() == 401 {
                warn!("Wrong credentials. Please try again...");
                continue;
            }

            self.authentication_token = Some(client.error_for_status()?.json::<LoginResult>().await?.token);
            return match &self.authentication_token {
                None => { Err(Error::msg("Invalid authentication token")) }
                Some(new_token) => {
                    Ok(new_token.token.clone())
                }
            };
        }
        Err(Error::msg("Authentication failed"))
    }

    pub async fn logout(&mut self) -> Result<(), Error> {
        if self.authentication_token.is_none() {
            return Err(Error::msg("Already disconnected"));
        }
        self.post("/user/logout/".to_string()).await?
            .send().await?.error_for_status()?;
        self.authentication_token = None;
        success!("Successfully disconnected");
        Ok(())
    }

    pub async fn get(&mut self, mut path: String) -> Result<reqwest::RequestBuilder, Error> {
        let url = if let Some(url) = self.url.clone() { url } else { return Err(Error::msg("Remote url is not set !")) };
        
        if !path.starts_with('/') {
            path = String::from("/") + path.as_str()
        };
        let mut request = self.client.get(format!("{}/api{}", url.origin, path));
        if let Some(authentication_token) =  &self.authentication_token {
            request = request.header("content-authtoken", authentication_token.token.encoded());
        };
        Ok(request)
    }

    pub async fn post(&mut self, path: String) -> Result<reqwest::RequestBuilder, Error> {
        let url = if let Some(url) = self.url.clone() { url } else { return Err(Error::msg("Remote url is not set !")) };
        let mut request = self.client.post(format!("{}/api{}", url.origin, path));
        if let Some(authentication_token) =  &self.authentication_token {
            request = request.header("content-authtoken", authentication_token.token.encoded());
        };
        Ok(request)
    }

    pub fn remote_id(&self) -> Result<RepositoryId, Error> {
        if let Some(url) = &self.url {
            Ok(url.remote_id.clone())
        } else {
            Err(Error::msg("Remote url is not set !"))
        }
    }

    pub async fn parse_result(&mut self, response: Response) -> Result<Response, Error> {
        if response.status().as_u16() == 401 {
            self.authenticate(None).await?;
        }
        Ok(response)
    }

    pub fn metadata_directory(&self) -> &MetaDir {
        &self.meta_dir
    }
}

impl Drop for Connection {
    fn drop(&mut self) {
        match serde_json::to_string(self) {
            Ok(config_string) => {
                if let Ok(config_path) = self.meta_dir.connection_config_path() {
                    match fs::write(config_path, config_string.as_str()) {
                        Ok(_) => {}
                        Err(_err) => { panic!("Failed to serialize local database : {_err}") }
                    };
                }
            }
            Err(_err) => { panic!("Failed to serialize local database : {_err}") }
        }
    }
}