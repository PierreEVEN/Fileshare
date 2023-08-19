const db = require('./../../../database')
const user = require('./user')

const Storage = require('../storage')
const repos_storage = new Storage();


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
        const result = await db.query('SELECT * FROM personal.repos WHERE id = ?', [this._id])
        await connection.end();

        if (Object.values(result).length > 0) {
            const data = result[0];
            this._owner = user.create(data.owner);
            this._name = data.name;
            this._status = data.status;
            this._access_key = data.access_key;
        } else {
            throw new Error(`Failed to get storage id '${this._id}'`);
        }
    }
}

/**
 * @return {Repos}
 */
function create(id) {
    let repos = repos_storage.find(id);
    if (!repos) {
        repos = new Repos(id);
        repos_storage.add(id);
    }
    return repos;
}


/**
 * @return {Promise<Repos>}
 */
async function insert() {
    const connection = await db();
    await connection.query('INSERT INTO personal.repos () VALUES ()', []);
    await connection.end();
}

module.exports = {create, insert};