use crate::{query_fmt, query_object, Database};
use anyhow::Error;
use postgres_from_row::FromRow;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use lettre::message::{Mailbox, MultiPart};
use lettre::{Message, SmtpTransport, Transport};
use lettre::transport::smtp::authentication::Credentials;
use rand::distr::{Alphanumeric, SampleString};
use tracing::info;
use types::database_ids::{PasswordHash, UserId};
use types::enc_string::EncString;
use utils::config::EMailerConfig;
use crate::user::DbUser;

#[derive(Debug, Default, Clone, FromRow, Serialize, Deserialize)]
pub struct ResetPasswords {
    user_id: UserId,
    code: String,
    expdate: i64,
}

impl ResetPasswords {
    pub async fn from_user(
        db: &Database,
        id: &UserId,
        code: &String,
    ) -> Result<ResetPasswords, Error> {
        match query_object!(
            db,
            ResetPasswords,
            "SELECT * FROM SCHEMA_NAME.resetpasswords WHERE user_id = $1 AND code = $2",
            id,
            code
        ) {
            None => Err(Error::msg("This user have not requested a password change")),
            Some(reset_password) => {
                if reset_password.expdate
                    < SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64
                {
                    query_fmt!(
                        db,
                        r#"DELETE FROM SCHEMA_NAME.resetpasswords WHERE user_id = $1;"#,
                        reset_password.user_id
                    );
                    return Err(Error::msg("Outdated request"));
                }
                Ok(reset_password)
            }
        }
    }

    pub async fn create(db: &Database, config: &EMailerConfig, id: &UserId) -> Result<(), Error> {
        let user = DbUser::from_id(db, id).await?;
        let code = Alphanumeric.sample_string(&mut rand::rng(), 8);
        // Expire in 15mn
        let exp_date = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64 + 15 * 60;
        query_fmt!(db, "INSERT INTO SCHEMA_NAME.resetpasswords (user_id, code, expdate) VALUES ($1, $2, $3) ON CONFLICT(user_id) DO UPDATE SET code = $2, expdate = $3;",
            id, code,
            exp_date
        );
        let username = user.name.plain()?;


        let email = Message::builder()
            .from(Mailbox::new(Some("Schedulator".to_string()), config.source_address.parse()?))
            .to(Mailbox::new(Some(username.clone()), user.email.plain()?.parse()?))
            .subject("Reset Schedulator password")
            .multipart(MultiPart::alternative_plain_html(
                String::from("You have asked for a password reinitialization."),
                String::from(format!("This reset code expire in 15 minutes.\n<b>{code}</b>\n\n\nPlease inform us if this wasn't you.")),
            ))?;

        // Open a remote connection to gmail
        let mut builder = SmtpTransport::relay(&config.smtp_server)?;
        if let Some((login, password)) = &config.smtp_auth {
            builder = builder.credentials(Credentials::new(login.clone(), password.clone()));
        }
        builder.build().send(&email)?;
        info!("Successfully sent reset password email to {}", user.email.plain()?);
        Ok(())
    }

    pub async fn reset_password(&self, db: &Database, password: &EncString) -> Result<(), Error> {
        query_fmt!(
            db,
            r#"DELETE FROM SCHEMA_NAME.resetpasswords WHERE user_id = $1;"#,
            self.user_id
        );

        if self.expdate < SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64 {
            query_fmt!(
                db,
                r#"DELETE FROM SCHEMA_NAME.resetpasswords WHERE user_id = $1;"#,
                self.user_id
            );
            return Err(Error::msg("Outdated request"));
        }

        let mut user = DbUser::from_id(db, &self.user_id).await?;
        DbUser::create_or_reset_password(&mut user, db, &PasswordHash::new(password)?).await?;
        Ok(())
    }
}
