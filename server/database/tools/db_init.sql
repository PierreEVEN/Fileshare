
-- ################################## SCHEMAS INITIALIZATION ##################################

CREATE SCHEMA IF NOT EXISTS fileshare;

-- ################################## CREATE TYPES ##################################

DO
$$
BEGIN
	CREATE TYPE fileshare.user_role AS ENUM ('guest', 'vip', 'admin');
	EXCEPTION WHEN DUPLICATE_OBJECT THEN
		RAISE NOTICE 'user_role already exists, skipping...';
END
$$;

DO
$$
BEGIN
	CREATE TYPE fileshare.repos_status AS ENUM ('private', 'hidden', 'public');
	EXCEPTION WHEN DUPLICATE_OBJECT THEN
		RAISE NOTICE 'repos_status already exists, skipping...';
END
$$;

DO
$$
BEGIN
	CREATE TYPE fileshare.user_access AS ENUM ('read-only', 'contributor', 'moderator');
	EXCEPTION WHEN DUPLICATE_OBJECT THEN
		RAISE NOTICE 'user_access already exists, skipping...';
END
$$;

-- ################################## CREATE TABLES ##################################

CREATE TABLE IF NOT EXISTS fileshare.users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(200) UNIQUE,
        name VARCHAR(200) UNIQUE,
        password_hash VARCHAR(64),
        allow_contact BOOLEAN DEFAULT false NOT NULL,
        role fileshare.user_role DEFAULT 'guest' NOT NULL
    );

CREATE TABLE IF NOT EXISTS fileshare.repos (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(200) UNIQUE NOT NULL,
        owner BIGSERIAL NOT NULL,
        description TEXT,
        status fileshare.repos_status DEFAULT 'hidden' NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        max_file_size BIGINT DEFAULT 1048576000,
        visitor_file_lifetime int,
        allow_visitor_upload BOOLEAN DEFAULT false NOT NULL,
        FOREIGN KEY(owner) REFERENCES fileshare.users(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.userrepos (
        owner BIGSERIAL,
        repos BIGSERIAL,
        access_type fileshare.user_access NOT NULL DEFAULT 'read-only',
        PRIMARY KEY(OWNER, repos),
        FOREIGN KEY(owner) REFERENCES fileshare.users(id),
        FOREIGN KEY(repos) REFERENCES fileshare.repos(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.authtoken (
        owner BIGSERIAL,
        token VARCHAR(200) NOT NULL UNIQUE,
        expdate BIGINT NOT NULL
    );

CREATE TABLE IF NOT EXISTS fileshare.items (
        id BIGSERIAL PRIMARY KEY,
        repos BIGSERIAL NOT NULL,
        owner BIGSERIAL NOT NULL,
        name VARCHAR(200) NOT NULL,
        is_regular_file BOOLEAN NOT NULL,
        description TEXT,
        parent_item BIGINT NULL,
        absolute_path VARCHAR DEFAULT NULL,
        FOREIGN KEY(Repos) REFERENCES fileshare.repos(id),
        FOREIGN KEY(owner) REFERENCES fileshare.users(id),
        FOREIGN KEY(parent_item) REFERENCES fileshare.items(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.file_data (
        id BIGSERIAL PRIMARY KEY,
        size BIGINT NOT NULL,
        mimetype VARCHAR(200) NOT NULL,
        hash VARCHAR(64) NOT NULL,
        timestamp BIGINT NOT NULL,
        FOREIGN KEY(id) REFERENCES fileshare.items(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.directory_data (
        id BIGSERIAL PRIMARY KEY,
        open_upload BOOLEAN NOT NULL,
        FOREIGN KEY(id) REFERENCES fileshare.items(id)
    );

-- ################################## FILE DUPPLICATION CHECK ##################################

CREATE OR REPLACE FUNCTION fileshare.ensure_item_does_not_exists() RETURNS TRIGGER AS $$
    DECLARE
        found_item_id BIGINT;
    BEGIN

        if NEW.parent_item IS NULL THEN
            SELECT id INTO found_item_id FROM fileshare.items WHERE parent_item IS NULL AND name = NEW.name and repos = NEW.repos;
            IF found_item_id IS NOT NULL
            THEN
                IF found_item_id != NEW.id
                THEN
                    RAISE EXCEPTION 'Cannot insert the same file twice (old id is %)', found_item_id;
                END IF;
            END IF;
        ELSE
            SELECT id INTO found_item_id FROM fileshare.items WHERE parent_item = NEW.parent_item AND name = NEW.name and repos = NEW.repos;

            IF found_item_id IS NOT NULL
            THEN
                IF found_item_id != NEW.id
                THEN
                    RAISE EXCEPTION 'Cannot insert the same file twice (old id is %)', found_item_id;
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER ensure_item_does_not_exists
    BEFORE INSERT ON fileshare.items
    FOR EACH ROW EXECUTE PROCEDURE fileshare.ensure_item_does_not_exists();

-- ################################## FILE AND DIRECTORY PATH PROCEDURES ##################################

CREATE OR REPLACE PROCEDURE fileshare.regenerate_item_path(item_id BIGINT) AS $$
	DECLARE
		path_string VARCHAR := '';
		item_name VARCHAR;
		updated_item BIGINT;
	BEGIN
		updated_item := item_id;
		WHILE item_id IS NOT NULL LOOP
			SELECT name INTO item_name FROM fileshare.items WHERE id = item_id;
			path_string := '/' || item_name || path_string;
			SELECT parent_item INTO item_id FROM fileshare.items WHERE id = item_id;
		END LOOP;

		UPDATE fileshare.items SET absolute_path = path_string WHERE id = updated_item;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE fileshare.regenerate_item_path_with_children(item_id BIGINT) AS $$
	DECLARE
		items_to_update BIGINT[];
		child_item_id BIGINT;
		child_item_cursor CURSOR FOR SELECT id FROM fileshare.items WHERE parent_item = item_id;
	BEGIN
		CALL fileshare.regenerate_item_path(item_id);
		OPEN child_item_cursor;
		LOOP
			FETCH child_item_cursor INTO child_item_id;
			EXIT WHEN NOT FOUND;
			CALL regenerate_item_path_with_children(child_item_id);
		END LOOP;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fileshare.make_item_path_up_to_date() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		IF OLD IS NULL OR NEW.parent_item != OLD.parent_item OR NEW.name != OLD.name THEN
			CALL fileshare.regenerate_item_path_with_children(NEW.id);
		END IF;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_items_path_up_to_date
	AFTER INSERT OR UPDATE ON fileshare.items
	FOR EACH ROW EXECUTE FUNCTION fileshare.make_item_path_up_to_date();