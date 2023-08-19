const mariadb = require("mariadb");
require('dotenv').config();

const pool = mariadb.createPool({
    host: 'localhost',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectionLimit: 5,
    database: 'Personal'
});

let initialized = false;

async function get() {
    let connection;
    try {
        if (!initialized) {
            connection = await pool.getConnection();

            // Create Personal database if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'Personal'")).length === 0) {
                await connection.query("CREATE DATABASE Personal");
            }

            // Create Accounts table if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Accounts'")).length === 0) {
                await connection.query("CREATE TABLE Personal.Accounts (id int AUTO_INCREMENT PRIMARY KEY, email varchar(200) UNIQUE, username varchar(200) UNIQUE, password_hash BINARY(64) DEFAULT false);")
            }

            // Create Accounts table if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Repos'")).length === 0) {
                await connection.query("CREATE TABLE Personal.Repos (id int AUTO_INCREMENT PRIMARY KEY, name varchar(200) UNIQUE NOT NULL, owner int NOT NULL, status ENUM('private', 'hidden', 'public'), access_key varchar(32) NOT NULL UNIQUE, FOREIGN KEY(owner) REFERENCES Personal.Accounts(id));")
            }

            // Create Accounts table if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'AccountRepos'")).length === 0) {
                await connection.query("CREATE TABLE Personal.AccountRepos (owner int, repos.js int, FOREIGN KEY(owner) REFERENCES Personal.Accounts(id),  PRIMARY KEY(OWNER, repos.js), FOREIGN KEY(repos.js) REFERENCES Personal.Repos(id));")
            }

            // Create Accounts table if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Storage'")).length === 0) {
                await connection.query("CREATE TABLE Personal.Storage (id int AUTO_INCREMENT PRIMARY KEY, repos.js int NOT NULL, owner int NOT NULL, name varchar(200) NOT NULL, description varchar(1200), storage_path varchar(200) NOT NULL UNIQUE, size int NOT NULL, mimetype varchar(200)  NOT NULL, virtual_folder varchar(200) NOT NULL, FOREIGN KEY(repos.js) REFERENCES Personal.Repos(id), FOREIGN KEY(owner) REFERENCES Personal.Accounts(id));")
            }

            await connection.end();
            initialized = true;
        }
    } catch (err) {
        throw err;
    }

    return pool.getConnection()
}

module.exports = get