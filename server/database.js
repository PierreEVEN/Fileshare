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
            token VARCHAR(200) NOT NULL,
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