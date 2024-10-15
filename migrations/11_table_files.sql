CREATE TABLE IF NOT EXISTS SCHEMA_NAME.files (
        id BIGSERIAL PRIMARY KEY,
        size BIGINT NOT NULL,
        mimetype VARCHAR(200) NOT NULL,
        timestamp BIGINT NOT NULL,
        object BIGINT NULL,
        FOREIGN KEY(id) REFERENCES SCHEMA_NAME.items(id),
        FOREIGN KEY(object) REFERENCES SCHEMA_NAME.objects(id)
    );

CREATE INDEX IF NOT EXISTS SCHEMA_NAME_files_object_index ON SCHEMA_NAME.files USING hash(object);