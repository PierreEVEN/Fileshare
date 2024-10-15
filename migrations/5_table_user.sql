CREATE TABLE IF NOT EXISTS SCHEMA_NAME.users (
        id BIGINT PRIMARY KEY,
        email VARCHAR(200) UNIQUE,
        name VARCHAR(200) UNIQUE,
        login VARCHAR(200) UNIQUE,
        password_hash VARCHAR(64),
        allow_contact BOOLEAN DEFAULT false NOT NULL,
        user_role SCHEMA_NAME.user_role DEFAULT 'guest' NOT NULL
    );

CREATE INDEX IF NOT EXISTS SCHEMA_NAME_users_name_index ON SCHEMA_NAME.users USING hash(name);