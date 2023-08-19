const mariadb = require("mariadb");
require('dotenv').config();

const pool = mariadb.createPool({
    host: 'localhost',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectionLimit: 5,
    database: 'Personal'
});

async function get() {
    return pool.getConnection()
}

module.exports = get