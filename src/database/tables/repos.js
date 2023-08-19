const db = require('./../../../database')
const Users = require('./user')

const Storage = require('../storage')
const crypto = require("crypto");
const repos_storage_id = new Storage();
const repos_storage_key = new Storage();


class Repos {
    constructor(id) {
        this._id = id;
    }

    /**
     * @return {Number}
     */
    get_id() {
        return this._id;
    }

    /**
     * @return {Promise<string>}
     */
    async get_name() {
        if (!this._name)
            await this._update_data_internal()
        return this._name;
    }

    /**
     * @return {Promise<User>}
     */
    async get_owner() {
        if (!this._owner)
            await this._update_data_internal()
        return this._owner;
    }

    /**
     * @return {Promise<string>}
     */
    async get_status() {
        if (!this._status)
            await this._update_data_internal()
        return this._status;
    }

    /**
     * @return {Promise<string>}
     */
    async get_access_key() {
        if (!this._access_key)
            await this._update_data_internal()
        return this._access_key;
    }

    async _update_data_internal() {
        const connection = await db();
        const result = await connection.query('SELECT * FROM personal.repos WHERE id = ?', [this._id])
        await connection.end();

        if (Object.values(result).length > 0) {
            const data = result[0];
            this._owner = await Users.find(data.owner);
            this._name = data.name;
            this._status = data.status;
            this._access_key = data.access_key;
        } else {
            throw new Error(`Failed to get repos id '${this._id}'`);
        }
    }

    async public_data() {
        if (!this._owner) {
            await this._update_data_internal()
        }
        return {
            id: this._id,
            owner: await this._owner.public_data(),
            name: this._name,
            status: this._status,
            access_key: this._access_key,
        }
    }
}


async function init_table() {

    const connection = await db();

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Repos'")).length === 0) {
        await connection.query("CREATE TABLE Personal.Repos (id int AUTO_INCREMENT PRIMARY KEY, name varchar(200) UNIQUE NOT NULL, owner int NOT NULL, status ENUM('private', 'hidden', 'public') NOT NULL, access_key varchar(32) NOT NULL UNIQUE, FOREIGN KEY(owner) REFERENCES Personal.Users(id));")
    }

    await connection.end();
}

const table_created = init_table();

/**
 * @return {Repos}
 */
async function create(id) {
    return await table_created.then(async () => {
        let repos = repos_storage_id.find(id);
        if (!repos) {
            repos = new Repos(id);
            repos_storage_id.add(id, repos);
            repos_storage_key.add(await repos.get_access_key(), repos)
        }
        return repos;
    })
}

/**
 * @return {Repos}
 */
async function create_access_key(access_key) {
    return await table_created.then(async () => {
        let repos = repos_storage_key.find(access_key);
        if (!repos) {
            const connection = await db();
            const entry = Object.values(await connection.query("SELECT * FROM Repos WHERE access_key = ?", [access_key]))
            if (entry.length > 0) {
                repos = new Repos(entry[0].id);
                repos_storage_id.add(repos.get_id(), repos);
                repos_storage_key.add(access_key, repos)
            }
            await connection.end()
        }
        return repos;
    })
}

/**
 * @return {Promise<Repos>}
 */
async function insert(name, owner, status, custom_access_key = null) {
    return await table_created.then(async () => {
        const connection = await db();

        let access_key = null;
        if (custom_access_key) {
            access_key = custom_access_key
        }
        else {
            do {
                access_key = crypto.randomBytes(16).toString("hex");
            }
            while (Object.entries(await connection.query('SELECT * FROM Personal.repos WHERE access_key = ?', [access_key])).length > 0);
        }

        const result = await connection.query('INSERT INTO personal.repos (name, owner, status, access_key) VALUES (?, ?, ?, ?)', [name, owner.get_id(), status, access_key]);
        await connection.end();

        return create(result.insertId);
    })
}

module.exports = {find: create, create_access_key, insert};