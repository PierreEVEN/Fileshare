const mariadb = require("mariadb");

const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    connectionLimit: 5,
    database: 'Fileshare'
});

async function get() {
    return pool.getConnection()
}

module.exports = get