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
    await connection.query(fs.readFileSync('server/db_init.sql').toString());

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
        },
        fetch_row: async (query, data) => {
            await table_created;
            const client = await pool.connect();
            clients_opened++;
            let row = null;
            const rows = (await query_checked(client, query, data)).rows;
            if (rows.length > 1) {
                logger.error(`Query '${query}' resulted in more than one result`)
                row = rows[0];
            }
            else if (rows.length === 1) {
                row = rows[0];
            }
            await client.release();
            clients_opened--;
            return row;
        }
    }
}

module.exports = {single, persist}