CREATE TABLE IF NOT EXISTS SCHEMA_NAME.authtoken(
        owner BIGINT NOT NULL,
        token VARCHAR(200) NOT NULL UNIQUE,
        device VARCHAR(255) NOT NULL,
        expdate BIGINT NOT NULL,
        FOREIGN KEY(owner) REFERENCES SCHEMA_NAME.users(id)
    );