
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
        root_item BIGSERIAL,
        access_type fileshare.user_access NOT NULL DEFAULT 'read-only',
        PRIMARY KEY(OWNER, repos, root_item),
        FOREIGN KEY(owner) REFERENCES fileshare.users(id),
        FOREIGN KEY(repos) REFERENCES fileshare.repos(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.authtoken(
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
        in_trash BOOLEAN DEFAULT FALSE NOT NULL,
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
		rec RECORD;
	BEGIN
		CALL fileshare.regenerate_item_path(item_id);
		FOR rec IN SELECT id FROM fileshare.items WHERE parent_item = item_id
           LOOP
			CALL fileshare.regenerate_item_path_with_children(rec.id);
           END LOOP;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fileshare.make_item_path_up_to_date() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		IF OLD IS NULL OR NEW.parent_item != OLD.parent_item OR NEW.name != OLD.name OR
		(NEW.parent_item    IS NULL AND NOT OLD.parent_item IS NULL) OR
		(OLD.parent_item IS NULL AND NOT NEW.parent_item IS NULL) THEN
			CALL fileshare.regenerate_item_path_with_children(NEW.id);
		END IF;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_items_path_up_to_date
	AFTER INSERT OR UPDATE ON fileshare.items
	FOR EACH ROW EXECUTE FUNCTION fileshare.make_item_path_up_to_date();

-- ################################## DIRECTORY RECURSION ##################################

CREATE OR REPLACE PROCEDURE fileshare.prevent_recursive_directories_func(tested_item_id BIGINT, current_dir_id BIGINT) AS $$
	DECLARE
		parent_id BIGINT;
	BEGIN
		IF tested_item_id = current_dir_id THEN
			RAISE EXCEPTION 'Recursion in hierarchy detected';
		END IF;
		IF current_dir_id IS NOT NULL THEN
			SELECT parent_item INTO parent_id FROM fileshare.items WHERE id = current_dir_id;
			CALL fileshare.prevent_recursive_directories_func(tested_item_id, parent_id);
		END IF;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fileshare.prevent_recursive_directories() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		CALL fileshare.prevent_recursive_directories_func(OLD.id, NEW.parent_item);
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_prevent_recursive_directories
	BEFORE INSERT OR UPDATE ON fileshare.items
	FOR EACH ROW EXECUTE FUNCTION fileshare.prevent_recursive_directories();


-- ################################## AUTO SET IN TRASH ##################################

CREATE OR REPLACE PROCEDURE fileshare.move_children_to_trash(parent BIGINT, set_in_trash BOOLEAN) AS $$
	DECLARE
		parent_id BIGINT;
		rec RECORD;
	BEGIN
		UPDATE fileshare.items SET in_trash = set_in_trash WHERE id = parent;
		FOR rec IN SELECT id FROM fileshare.items WHERE parent_item = parent
           LOOP
			CALL fileshare.move_children_to_trash(rec.id, set_in_trash);
        END LOOP;
	END;
	$$ LANGUAGE plpgsql;


CREATE OR REPLACE PROCEDURE fileshare.init_move_children_to_trash(item BIGINT, set_in_trash BOOLEAN) AS $$
	DECLARE
		parent_id BIGINT;
		parent RECORD;
	BEGIN
	    -- Also restore parent if they are in trash
	    IF NOT set_in_trash AND THEN
	        SELECT * INTO parent FROM fileshare.items WHERE id = (SELECT parent_item FROM fileshare.items WHERE id = item);
	        IF parent.in_trash THEN
			    CALL fileshare.move_children_to_trash(parent.id, set_in_trash);
			    return;
	        END IF;
	    END IF;
		CALL fileshare.move_children_to_trash(item, set_in_trash);
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fileshare.move_items_to_trashs() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		IF NOT OLD.in_trash = NEW.in_trash THEN
			CALL fileshare.init_move_children_to_trash(NEW.id, NEW.in_trash);
		END IF;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_move_trash_recursive
	AFTER UPDATE ON fileshare.items
	FOR EACH ROW EXECUTE FUNCTION fileshare.move_items_to_trashs();

ALTER TABLE fileshare.authtoken ADD COLUMN IF NOT EXISTS device VARCHAR(255) NOT NULL DEFAULT 'undefined';