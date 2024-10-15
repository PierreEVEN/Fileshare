CREATE TABLE IF NOT EXISTS SCHEMA_NAME.repository (
        id BIGSERIAL PRIMARY KEY,
        url_name VARCHAR(200) UNIQUE NOT NULL,
        owner BIGSERIAL NOT NULL,
        description TEXT,
        status SCHEMA_NAME.repository_status DEFAULT 'hidden' NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        max_file_size BIGINT DEFAULT NULL,
        visitor_file_lifetime BIGINT NULL,
        allow_visitor_upload BOOLEAN DEFAULT false NOT NULL,
        FOREIGN KEY(owner) REFERENCES SCHEMA_NAME.users(id)
    );

CREATE INDEX IF NOT EXISTS SCHEMA_NAME_repository_url_name_index ON SCHEMA_NAME.repository USING hash(url_name);