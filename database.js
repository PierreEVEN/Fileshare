const mariadb = require("mariadb");
require('dotenv').config();

const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectionLimit: 5,
    database: 'Personal'
});

async function get() {
    return await pool.getConnection()
}

module.exports = get