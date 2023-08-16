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
            console.log("A")
            connection = await pool.getConnection();

            console.log("B")
            // Create Personal database if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'Personal'")).length === 0) {
                await connection.query("CREATE DATABASE Personal");
            }

            console.log("C")
            // Create Accounts table if needed
            if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Accounts'")).length === 0) {
                await connection.query("CREATE TABLE Personal.Accounts (id int AUTO_INCREMENT PRIMARY KEY, email varchar(200) UNIQUE, username varchar(200) UNIQUE, password_hash BINARY(64) DEFAULT false);")
            }

            console.log("B")
            await connection.end();
            initialized = true;
            console.log("C")
        }
    } catch (err) {
        throw err;
    }

    return pool.getConnection()
}

module.exports = get