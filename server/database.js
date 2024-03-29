const {logger} = require("./logger");
const fs = require("fs");
const path = require("path");
const postgres = require('pg');

const pool = new postgres.Pool({
    user: process.env.DATABASE_USER,
    host: 'localhost',
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
})
// the pool with emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, _) => {
    console.error('Unexpected error on idle client', err) // your callback here
    process.exit(-1)
})

const table_created = (async () => {
    let connection = await pool.connect();

    await connection.query(`CREATE SCHEMA IF NOT EXISTS fileshare;`);

    // Create Accounts table if needed
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'users'")).rowCount === 0) {
        if ((await connection.query(`SELECT 1 FROM pg_type WHERE typname = 'user_role'`)).rowCount === 0)
            await connection.query(`CREATE  TYPE user_role AS ENUM ('guest', 'vip', 'admin');`);
        logger.warn('Create Users table');
        await connection.query(`CREATE TABLE fileshare.users (
                id BIGSERIAL PRIMARY KEY,
                email VARCHAR(200) UNIQUE,
                name VARCHAR(200) UNIQUE,
                password_hash VARCHAR(64),
                allow_contact BOOLEAN DEFAULT false NOT NULL,
                role user_role DEFAULT 'guest' NOT NULL
        );`)
    }

    // Create repos table if needed
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'repos'")).rowCount === 0) {

        if ((await connection.query(`SELECT 1 FROM pg_type WHERE typname = 'repos_status'`)).rowCount === 0)
            await connection.query(`CREATE TYPE repos_status AS ENUM ('private', 'hidden', 'public');`);

        logger.warn('Create Repos table');
        await connection.query(`CREATE TABLE fileshare.repos (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(200) UNIQUE NOT NULL,
            owner BIGINT NOT NULL,
            description TEXT,
            status repos_status DEFAULT 'hidden' NOT NULL,
            access_key VARCHAR(32) NOT NULL UNIQUE,
            max_file_size BIGINT DEFAULT 1048576000,
            visitor_file_lifetime int,
            allow_visitor_upload BOOLEAN DEFAULT false NOT NULL,
            FOREIGN KEY(owner) REFERENCES fileshare.users(id)
        );`)
    }

    // Create Accounts table if needed
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'userrepos'")).rowCount === 0) {
        if ((await connection.query(`SELECT 1 FROM pg_type WHERE typname = 'user_access'`)).rowCount === 0)
            await connection.query(`CREATE  TYPE user_access AS ENUM ('read-only', 'contributor', 'moderator');`);
        logger.warn('Create userrepos table');
        await connection.query(`CREATE TABLE fileshare.userrepos (
            owner BIGINT,
            repos BIGINT,
            access_type user_access NOT NULL DEFAULT 'read-only',
            PRIMARY KEY(OWNER, repos),
            FOREIGN KEY(owner) REFERENCES fileshare.users(id),
            FOREIGN KEY(repos) REFERENCES fileshare.repos(id)
        );`)
    }

    // Create AuthToken table if needed. The expDate is the timestamp in milliseconds since 1970
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'authtoken'")).rowCount === 0) {
        logger.warn('Create authtoken table');
        await connection.query(`CREATE TABLE fileshare.authtoken (
            owner BIGINT,
            token VARCHAR(200) NOT NULL UNIQUE,
            expdate BIGINT NOT NULL
        );`)
    }

    // Create Directories table if needed
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'directories'")).rowCount === 0) {
        logger.warn('Create Directories table');
        await connection.query(`CREATE TABLE fileshare.directories (
                id BIGINT PRIMARY KEY,
                repos BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                is_special BOOLEAN DEFAULT false,
                parent_directory BIGINT NULL,
                open_upload BOOLEAN NOT NULL,
                FOREIGN KEY(Repos) REFERENCES fileshare.repos(id),
                FOREIGN KEY(owner) REFERENCES fileshare.users(id),
                FOREIGN KEY(parent_directory) REFERENCES fileshare.directories(id)
        );`)
    }


    if ((await connection.query("SELECT * FROM pg_proc WHERE proname = 'ensure_file_does_not_exists'")).rowCount === 0) {
        logger.warn('Create ensure_file_does_not_exists procedure and triggers');
        await connection.query(`CREATE OR REPLACE FUNCTION ensure_file_does_not_exists()
                                  RETURNS TRIGGER AS $$
                                DECLARE
                                    found_file_id VARCHAR(32);
                                BEGIN
                                
                                    SELECT id INTO found_file_id FROM fileshare.files WHERE parent_directory = NEW.parent_directory AND name = NEW.name;
                                    
                                  IF found_file_id IS NOT NULL
                                  THEN
                                    IF found_file_id != NEW.id
                                    THEN
                                        RAISE EXCEPTION 'Cannot insert the same file twice';
                                    END IF;
                                  END IF;
                                  RETURN NEW;
                                END;
                                $$ LANGUAGE plpgsql;
                                
                                CREATE OR REPLACE TRIGGER trig_ins_ensure_file_does_not_exists 
                                BEFORE INSERT ON fileshare.files 
                                FOR EACH ROW EXECUTE PROCEDURE ensure_file_does_not_exists();
                                
                                
                                CREATE OR REPLACE FUNCTION ensure_directory_does_not_exists()
                                  RETURNS TRIGGER AS $$
                                DECLARE
                                    found_dir_id BIGINT;
                                BEGIN
                                
                                    SELECT id INTO found_dir_id FROM fileshare.directories WHERE parent_directory = NEW.parent_directory AND name = NEW.name;
                                    
                                  IF found_dir_id IS NOT NULL
                                  THEN
                                    RAISE EXCEPTION 'Cannot insert the same file twice';
                                  END IF;
                                  RETURN NEW;
                                END;
                                $$ LANGUAGE plpgsql;
                                
                                CREATE OR REPLACE TRIGGER trig_ins_ensure_directory_does_not_exists 
                                BEFORE INSERT ON fileshare.directories
                                FOR EACH ROW EXECUTE PROCEDURE ensure_directory_does_not_exists();
                                `);
    }

    if ((await connection.query("SELECT * FROM pg_proc WHERE proname = 'find_file_by_path'")).rowCount === 0) {
        logger.warn('Create find_file_by_path procedure');
        await connection.query(`CREATE OR REPLACE FUNCTION find_file_by_path(target_path VARCHAR, repos_id BIGINT)
                                RETURNS SETOF fileshare.files AS $$
                                    DECLARE
                                        path_elements VARCHAR[];
                                        current_parent_dir BIGINT;
                                    BEGIN
                                        -- Split the path into an array of elements
                                        path_elements := string_to_array(target_path, '/');
                        
                                        current_parent_dir := NULL;
                        
                                        -- Iterate through each directory in the path
                                        FOR i IN 1..array_length(path_elements, 1) - 1 LOOP	
                                        
                                            IF current_parent_dir IS NULL THEN
                                                SELECT id INTO current_parent_dir
                                                    FROM fileshare.directories
                                                    WHERE repos = repos_id AND parent_directory IS NULL AND name = path_elements[i];
                                            ELSE
                                                SELECT id INTO current_parent_dir
                                                    FROM fileshare.directories
                                                    WHERE repos = repos_id AND parent_directory = current_parent_dir AND name = path_elements[i];
                                            END IF;
                        
                                            -- If no match is found, the directory doesn't exist
                                            IF current_parent_dir IS NULL THEN
                                                RETURN;
                                            END IF;
                                        END LOOP;
                                        
                        
                                        IF current_parent_dir IS NULL THEN
                                            RETURN QUERY SELECT *
                                                         FROM fileshare.files
                                                         WHERE repos = repos_id AND 
                                                               name = path_elements[array_upper(path_elements, 1)] AND
                                                               parent_directory IS NULL;
                                        ELSE
                                            RETURN QUERY SELECT *
                                                         FROM fileshare.files
                                                         WHERE repos = repos_id AND 
                                                               name = path_elements[array_upper(path_elements, 1)] AND
                                                               parent_directory = current_parent_dir;
                                        END IF;
                        
                                    END;
                                $$ LANGUAGE plpgsql;`);
    }

    // Create Files table if needed
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'files'")).rowCount === 0) {
        logger.warn('Create fileshare table');

        await connection.query(`CREATE TABLE fileshare.files(
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
                FOREIGN KEY(repos) REFERENCES fileshare.repos(id),
                FOREIGN KEY(owner) REFERENCES fileshare.users(id),
                FOREIGN KEY(parent_directory) REFERENCES fileshare.directories(id)
        );`)
    }
    else if ((await connection.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'timestamp'")).rowCount === 0) {
        logger.warn('Add timestamp row to fileshare.files');
        await connection.query(`ALTER TABLE fileshare.files ADD COLUMN timestamp BIGINT NOT NULL DEFAULT ${new Date().getTime()};`);
    }
    const storage_path = path.resolve(process.env.FILE_STORAGE_PATH)
    if (!fs.existsSync(storage_path))
        fs.mkdirSync(storage_path);

    await connection.release();
})();


async function persist() {
    await table_created;
    const client = await pool.connect();
    return {
        query: async (query, data) => await query_checked(client, query, data),
        end: async () => await client.release(),
        rows: async (query, data) => (await query_checked(client, query, data)).rows,
        found: async (query, data) => (await query_checked(client, query, data)).rowCount !== 0,
        fetch_objects: async (Ctor, query, data) => {
            const objs = []
            for (const object of (await query_checked(client, query, data)).rows)
                objs.push(new Ctor(object));
            return objs;
        },
        fetch_object: async (Ctor, query, data) => {
            const rows = (await query_checked(client, query, data)).rows;
            if (rows.length > 1) {
                logger.error(`Query '${query}' resulted in more than one result`)
                return new Ctor(rows[0]);
            }
            if (rows.length === 1)
                return new Ctor(rows[0]);
            return null;
        }
    }
}

async function query_checked(client, query, data) {
    return await client.query(query, data)
        .catch(err => {
            logger.error(`Request failed : '${query}'\n${data ? JSON.stringify(Object.values(data)) : '[]'}\n${err.toString()}`)
            throw new Error();
        });
}

let clients_opened = 0;

function single() {
    return {
        query: async (query, data) => {
            await table_created;
            const client = await pool.connect();
            clients_opened++;
            const res = await query_checked(client, query, data)
            await client.release();
            clients_opened--;
            return res;
        },
        rows: async (query, data) => {
            await table_created;
            const client = await pool.connect();
            clients_opened++;
            const res = (await query_checked(client, query, data)).rows
            await client.release();
            clients_opened--;
            return res;
        },
        found: async (query, data) => {
            await table_created;
            const client = await pool.connect();
            clients_opened++;
            const res = (await query_checked(client, query, data)).rowCount !== 0
            await client.release();
            clients_opened--;
            return res;
        },
        fetch_objects: async (Ctor, query, data) => {
            await table_created;
            const client = await pool.connect();
            clients_opened++;
            const objs = []
            for (const object of (await query_checked(client, query, data)).rows)
                objs.push(new Ctor(object));
            await client.release();
            clients_opened--;
            return objs;
        },
        fetch_object: async (Ctor, query, data) => {
            await table_created;
            const client = await pool.connect();
            clients_opened++;
            const rows = (await query_checked(client, query, data)).rows;
            let res = null;
            if (rows.length > 1) {
                logger.error(`Query '${query}' resulted in more than one result`)
                res = new Ctor(rows[0]);
            }
            else if (rows.length === 1)
                res = new Ctor(rows[0]);
            await client.release();
            clients_opened--;
            return res;
        }
    }
}

module.exports = {single, persist}