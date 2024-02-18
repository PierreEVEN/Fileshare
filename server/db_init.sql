
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
        owner BIGINT NOT NULL,
        description TEXT,
        status fileshare.repos_status DEFAULT 'hidden' NOT NULL,
        access_key VARCHAR(32) NOT NULL UNIQUE,
        max_file_size BIGINT DEFAULT 1048576000,
        visitor_file_lifetime int,
        allow_visitor_upload BOOLEAN DEFAULT false NOT NULL,
        FOREIGN KEY(owner) REFERENCES fileshare.users(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.userrepos (
        owner BIGINT,
        repos BIGINT,
        access_type fileshare.user_access NOT NULL DEFAULT 'read-only',
        PRIMARY KEY(OWNER, repos),
        FOREIGN KEY(owner) REFERENCES fileshare.users(id),
        FOREIGN KEY(repos) REFERENCES fileshare.repos(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.authtoken (
        owner BIGINT,
        token VARCHAR(200) NOT NULL UNIQUE,
        expdate BIGINT NOT NULL
    );

CREATE TABLE IF NOT EXISTS fileshare.directories (
        id BIGINT PRIMARY KEY,
        repos BIGINT NOT NULL,
        owner BIGINT NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        is_special BOOLEAN DEFAULT false,
        parent_directory BIGINT NULL,
        open_upload BOOLEAN NOT NULL,
        absolute_path VARCHAR DEFAULT NULL,
        FOREIGN KEY(Repos) REFERENCES fileshare.repos(id),
        FOREIGN KEY(owner) REFERENCES fileshare.users(id),
        FOREIGN KEY(parent_directory) REFERENCES fileshare.directories(id)
    );

CREATE TABLE IF NOT EXISTS fileshare.files(
        id VARCHAR(32) PRIMARY KEY,
        repos BIGINT NOT NULL,
        owner BIGINT NOT NULL,
        parent_directory BIGINT,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        size BIGINT NOT NULL,
        mimetype VARCHAR(200) NOT NULL,
        hash VARCHAR(64) NOT NULL,
        timestamp BIGINT NOT NULL,
        absolute_path VARCHAR DEFAULT NULL,
        FOREIGN KEY(repos) REFERENCES fileshare.repos(id),
        FOREIGN KEY(owner) REFERENCES fileshare.users(id),
        FOREIGN KEY(parent_directory) REFERENCES fileshare.directories(id)
    );


-- ################################## FILE DUPPLICATION CHECK ##################################

CREATE OR REPLACE FUNCTION fileshare.ensure_file_does_not_exists() RETURNS TRIGGER AS $$
    DECLARE
        found_file_id VARCHAR(32);
    BEGIN

        SELECT id INTO found_file_id FROM fileshare.files WHERE parent_directory = NEW.parent_directory AND name = NEW.name and repos = NEW.repos;

      IF found_file_id IS NOT NULL
      THEN
        IF found_file_id != NEW.id
        THEN
            RAISE EXCEPTION 'Cannot insert the same file twice (old id is %)', found_file_id;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_file_does_not_exists
    BEFORE INSERT ON fileshare.files
    FOR EACH ROW EXECUTE PROCEDURE fileshare.ensure_file_does_not_exists();


CREATE OR REPLACE FUNCTION fileshare.ensure_directory_does_not_exists() RETURNS TRIGGER AS $$
    DECLARE
        found_dir_id BIGINT;
    BEGIN
        SELECT id INTO found_dir_id FROM fileshare.directories WHERE parent_directory = NEW.parent_directory AND name = NEW.name and repos = NEW.repos;

        IF found_dir_id IS NOT NULL
        THEN
            RAISE EXCEPTION 'Cannot insert the same directory twice (old id is %)', found_dir_id;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_directory_does_not_exists
    BEFORE INSERT ON fileshare.directories
    FOR EACH ROW EXECUTE PROCEDURE fileshare.ensure_directory_does_not_exists();

-- ################################## FILE AND DIRECTORY PATH PROCEDURES ##################################

CREATE OR REPLACE PROCEDURE fileshare.regenerate_directory_path(directory_id BIGINT) AS $$
	DECLARE
		path_string VARCHAR := '/';
		directory_name VARCHAR;
		updated_dir BIGINT;
	BEGIN
		updated_dir := directory_id;
		WHILE directory_id IS NOT NULL LOOP
			SELECT name INTO directory_name FROM fileshare.directories WHERE id = directory_id;
			path_string := '/' || directory_name || path_string;
			SELECT parent_directory INTO directory_id FROM fileshare.directories WHERE id = directory_id;
		END LOOP;

		UPDATE fileshare.directories SET absolute_path = path_string WHERE id = updated_dir;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE fileshare.regenerate_file_path(file_id VARCHAR) AS $$
	DECLARE
		path_string VARCHAR := '/';
		directory_name VARCHAR;
		updated_file VARCHAR;
		directory_id BIGINT;
	BEGIN
		updated_file := file_id;
		SELECT name, parent_directory INTO path_string, directory_id FROM fileshare.files WHERE id = file_id;
		path_string := '/' || path_string;
		WHILE directory_id IS NOT NULL LOOP
			SELECT name INTO directory_name FROM fileshare.directories WHERE id = directory_id;
			path_string := '/' || directory_name || path_string;
			SELECT parent_directory INTO directory_id FROM fileshare.directories WHERE id = directory_id;
		END LOOP;

		UPDATE fileshare.files SET absolute_path = path_string WHERE id = updated_file;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE fileshare.regenerate_directory_path_with_children(directory_id BIGINT) AS $$
	DECLARE
		dirs_to_update BIGINT[];
		child_dir_id BIGINT;
		child_file_id VARCHAR;
		child_dir_cursor CURSOR FOR SELECT id FROM fileshare.directories WHERE parent_directory = directory_id;
		child_file_cursor CURSOR FOR SELECT id FROM fileshare.files WHERE parent_directory = directory_id;
	BEGIN
		CALL fileshare.regenerate_directory_path(directory_id);
		OPEN child_dir_cursor;
		LOOP
			FETCH child_dir_cursor INTO child_dir_id;
			EXIT WHEN NOT FOUND;
			CALL regenerate_directory_path_with_children(child_dir_id);
		END LOOP;

		OPEN child_file_cursor;
		LOOP
			FETCH child_file_cursor INTO child_file_id;
			EXIT WHEN NOT FOUND;
			CALL fileshare.regenerate_file_path(child_file_id);
		END LOOP;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fileshare.make_directory_path_up_to_date() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		IF NEW.parent_directory != OLD.parent_directory OR NEW.name != OLD.name THEN
			CALL fileshare.regenerate_directory_path_with_children(NEW.id);
		END IF;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_directory_path_up_to_date
	AFTER INSERT OR UPDATE ON fileshare.directories
	FOR EACH ROW EXECUTE FUNCTION fileshare.make_directory_path_up_to_date();

CREATE OR REPLACE FUNCTION fileshare.make_file_path_up_to_date() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		IF NEW.parent_directory != OLD.parent_directory OR NEW.name != OLD.name THEN
			CALL fileshare.regenerate_file_path(NEW.id);
		END IF;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_file_path_up_to_date
	AFTER INSERT OR UPDATE ON fileshare.files
	FOR EACH ROW EXECUTE FUNCTION fileshare.make_file_path_up_to_date();