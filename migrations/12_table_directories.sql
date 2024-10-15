CREATE TABLE IF NOT EXISTS SCHEMA_NAME.directories (
        id BIGSERIAL PRIMARY KEY,
        open_upload BOOLEAN NOT NULL,
        num_items BIGINT NOT NULL DEFAULT 0,
        content_size BIGINT NOT NULL DEFAULT 0,
        FOREIGN KEY(id) REFERENCES SCHEMA_NAME.items(id)
    );