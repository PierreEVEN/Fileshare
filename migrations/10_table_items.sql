CREATE TABLE IF NOT EXISTS SCHEMA_NAME.items (
        id BIGSERIAL PRIMARY KEY,
        repository BIGSERIAL NOT NULL,
        owner BIGSERIAL NOT NULL,
        name VARCHAR(200) NOT NULL,
        is_regular_file BOOLEAN NOT NULL,
        description TEXT,
        parent_item BIGINT NULL,
        absolute_path VARCHAR DEFAULT NULL,
        in_trash BOOLEAN DEFAULT FALSE NOT NULL,
        FOREIGN KEY(repository) REFERENCES SCHEMA_NAME.repository(id),
        FOREIGN KEY(owner) REFERENCES SCHEMA_NAME.users(id),
        FOREIGN KEY(parent_item) REFERENCES SCHEMA_NAME.items(id),
        CONSTRAINT items_absolute_path_key UNIQUE (absolute_path, repository)
    );

CREATE INDEX IF NOT EXISTS SCHEMA_NAME_items_parent_item_index ON SCHEMA_NAME.items USING hash(parent_item);
CREATE INDEX IF NOT EXISTS SCHEMA_NAME_items_absolute_path_index ON SCHEMA_NAME.items USING btree(absolute_path);
CREATE INDEX IF NOT EXISTS SCHEMA_NAME_items_name_index ON SCHEMA_NAME.items USING hash(name);