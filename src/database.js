const mariadb = require("mariadb");
const {logger} = require("./logger");
const fs = require("fs");
const path = require("path");
const postgres = require('pg');

/*
const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectionLimit: 5
});
 */
const pool = new postgres.Pool({
    user: 'postgres',
    host: 'localhost',
    password: 'Tecaxa_4',
    port: 5432,
})

const table_created = (async () => {
    let connection = pool;//await pool.getConnection();

    await connection.query(`CREATE SCHEMA IF NOT EXISTS Fileshare;`);

    // Create Accounts table if needed
    if ((await connection.query("SELECT * FROM pg_tables WHERE schemaname = 'fileshare' AND tablename = 'users'")).rowCount === 0) {
        if ((await connection.query(`SELECT 1 FROM pg_type WHERE typname = 'user_role'`)).rowCount === 0)
            await connection.query(`CREATE  TYPE user_role AS ENUM ('guest', 'vip', 'admin');`);
        logger.warn('Create Users table');
        await connection.query(`CREATE TABLE Fileshare.Users (
                id BIGSERIAL PRIMARY KEY,
                email VARCHAR(200) UNIQUE,
                name VARCHAR(200) UNIQUE,
                password_hash VARCHAR(64),
                allow_contact BOOLEAN DEFAULT false NOT NULL,
                role user_role DEFAULT 'guest' NOT NULL
        );`)
    }

    // Create Accounts table if needed
    if ((await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Repos'")).rowCount === 0) {

        if ((await connection.query(`SELECT 1 FROM pg_type WHERE typname = 'repos_status'`)).rowCount === 0)
            await connection.query(`CREATE TYPE repos_status AS ENUM ('private', 'hidden', 'public');`);

        logger.warn('Create Repos table');
        await connection.query(`CREATE TABLE Fileshare.Repos (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(200) UNIQUE NOT NULL,
            owner BIGINT NOT NULL,
            status repos_status DEFAULT 'hidden' NOT NULL,
            access_key VARCHAR(32) NOT NULL UNIQUE,
            max_file_size BIGINT DEFAULT 1048576000,
            visitor_file_lifetime int,
            allow_visitor_upload BOOLEAN DEFAULT false NOT NULL,
            FOREIGN KEY(owner) REFERENCES Fileshare.Users(id)
        );`)
    }
    console.log('C');

    // Create Accounts table if needed
    if ((await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'UserRepos'")).rowCount === 0) {
        logger.warn('Create UserRepos table');
        await connection.query(`CREATE TABLE Fileshare.UserRepos (
            owner BIGINT,
            repos BIGINT,
            access_type ENUM('read-only', 'contributor', 'moderator') NOT NULL DEFAULT 'read-only',
            PRIMARY KEY(OWNER, repos),
            FOREIGN KEY(owner) REFERENCES Fileshare.Users(id),
            FOREIGN KEY(repos) REFERENCES Fileshare.Repos(id)
        );`)
    }

    // Create Directories table if needed
    if ((await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Directories'")).rowCount === 0) {
        logger.warn('Create Directories table');
        await connection.query(`CREATE TABLE Fileshare.Directories (
                id BIGINT PRIMARY KEY,
                repos BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                name VARCHAR(200) NOT NULL,
                description VARCHAR(1200),
                is_special BOOLEAN DEFAULT false,
                parent_directory BIGINT NULL,
                open_upload BOOLEAN NOT NULL,
                FOREIGN KEY(Repos) REFERENCES Fileshare.Repos(id),
                FOREIGN KEY(owner) REFERENCES Fileshare.Users(id),
                FOREIGN KEY(parent_directory) REFERENCES Fileshare.Directories(id)
        );`)
    }

    // Create Files table if needed
    if ((await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Files'")).rowCount === 0) {
        logger.warn('Create Files table');
        await connection.query(`CREATE TABLE Fileshare.Files(
                id VARCHAR(32) PRIMARY KEY,
                repos BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                parent_directory BIGINT,
                name VARCHAR(200) NOT NULL,
                description VARCHAR(1200),
                size BIGINT NOT NULL,
                mimetype VARCHAR(200) NOT NULL,
                hash VARCHAR(64) NOT NULL,
                FOREIGN KEY(repos) REFERENCES Fileshare.Repos(id),
                FOREIGN KEY(owner) REFERENCES Fileshare.Users(id),
                FOREIGN KEY(parent_directory) REFERENCES Fileshare.Directories(id)
        );`)
    }
    const storage_path = path.resolve(process.env.FILE_STORAGE_PATH)
    if (!fs.existsSync(storage_path))
        fs.mkdirSync(storage_path);

    await connection.end();
})();


async function get() {
    await table_created;
    return pool.getConnection()
}

module.exports = get