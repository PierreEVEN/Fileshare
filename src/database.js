const mariadb = require("mariadb");
const {logger} = require("./logger");
const fs = require("fs");
const path = require("path");

const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectionLimit: 5
});

const table_created = (async () => {
    let connection = await pool.getConnection();

    await connection.query(`CREATE DATABASE IF NOT EXISTS Fileshare;`)

    const charset = Object.values(await connection.query(`SELECT default_character_set_name FROM information_schema.SCHEMATA S WHERE schema_name = "Fileshare";`))[0].default_character_set_name;
    if (charset !== 'utf8mb4') {
        await connection.query(`ALTER DATABASE Fileshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
        logger.warn('changed database default encoding to utf8mb4');
    }

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Users'")).length === 0) {
        logger.warn('Create Users table');
        await connection.query(`CREATE TABLE Fileshare.Users (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(200) UNIQUE,
                name VARCHAR(200) UNIQUE,
                password_hash VARCHAR(64),
                allow_contact BOOLEAN DEFAULT false NOT NULL,
                role ENUM('visitor', 'guest', 'vip', 'admin') DEFAULT 'visitor' NOT NULL
        );`)
    }

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Repos'")).length === 0) {
        logger.warn('Create Repos table');
        await connection.query(`CREATE TABLE Fileshare.Repos (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(200) UNIQUE NOT NULL,
            owner BIGINT NOT NULL,
            status ENUM('private', 'hidden', 'public') DEFAULT 'hidden' NOT NULL,
            access_key VARCHAR(32) NOT NULL UNIQUE,
            max_file_size BIGINT DEFAULT 1048576000,
            visitor_file_lifetime int,
            allow_visitor_upload BOOLEAN DEFAULT false NOT NULL,
            FOREIGN KEY(owner) REFERENCES Fileshare.Users(id)
        );`)
    }

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'UserRepos'")).length === 0) {
        logger.warn('Create UserRepos table');
        await connection.query(`CREATE TABLE Fileshare.UserRepos (
            owner BIGINT,
            repos BIGINT,
            access_type ENUM('read-only', 'contributor', 'moderator') NOT NULL,
            PRIMARY KEY(OWNER, repos),
            FOREIGN KEY(owner) REFERENCES Fileshare.Users(id),
            FOREIGN KEY(repos) REFERENCES Fileshare.Repos(id)
        );`)
    }

    // Create Directories table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Directories'")).length === 0) {
        logger.warn('Create Directories table');
        await connection.query(`CREATE TABLE Fileshare.Directories (
                id BIGINT PRIMARY KEY,
                repos BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                name VARCHAR(200) NOT NULL,
                description VARCHAR(1200),
                is_special BOOLEAN DEFAULT false,
                parent_directory BIGINT NULL,
                absolute_path VARCHAR(200),
                FOREIGN KEY(Repos) REFERENCES Fileshare.Repos(id),
                FOREIGN KEY(owner) REFERENCES Fileshare.Users(id),
                FOREIGN KEY(parent_directory) REFERENCES Fileshare.Directories(id)
        );`)
    }

    // Create Files table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'Files'")).length === 0) {
        logger.warn('Create Fileshare table');
        await connection.query(`CREATE TABLE Fileshare.Files (
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