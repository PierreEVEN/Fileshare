const db = require('./../../../database')

const Storage = require('../storage');
const repos = require('./repos');
const user = require('./user');

const user_files = new Storage();

class File {
    constructor(id) {
        this._id = id;
    }

    /**
     * @return {number}
     */
    get_id() {
        return this._id;
    }

    /**
     * @return {Promise<Repos>}
     */
    async get_repos() {
        if (!this._repos)
            await this._update_data_internal()
        return this._repos;
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
    async get_name() {
        if (!this._name)
            await this._update_data_internal()
        return this._name;
    }

    /**
     * @return {Promise<string>}
     */
    async get_description() {
        if (!this._description)
            await this._update_data_internal()
        return this._description;
    }

    /**
     * @return {Promise<string>}
     */
    async get_storage_path() {
        if (!this._storage_path)
            await this._update_data_internal()
        return this._storage_path;
    }

    /**
     * @return {Promise<number>}
     */
    async get_size() {
        if (!this._size)
            await this._update_data_internal()
        return this._size;
    }

    /**
     * @return {Promise<string>}
     */
    async get_mimetype() {
        if (!this._mimetype)
            await this._update_data_internal()
        return this._mimetype;
    }

    /**
     * @return {Promise<string>}
     */
    async get_virtual_folder() {
        if (!this._virtual_folder)
            await this._update_data_internal()
        return this._virtual_folder;
    }

    async _update_data_internal() {
        const connection = await db();
        const result = await connection.query('SELECT * FROM personal.storage WHERE id = ?', [this._id]);
        await connection.end();

        if (Object.values(result).length > 0) {
            const data = result[0];

            this._repos = repos.create(data.repos);
            this._owner = user.create(data.owner);
            this._name = data.name;
            this._description = data.description;
            this._storage_path = data.storage_path;
            this._size = data.size;
            this._mimetype = data.mimetype;
            this._virtual_folder = data.virtual_folder;
        }
        else {
            throw new Error(`Failed to get storage id '${this._id}'`);
        }
    }
}

/**
 * @return {File}
 */
function create(id) {
    let file = user_files.find(id);
    if (!file) {
        file = new File(id);
        user_files.add(id);
    }
    return file;
}

/**
 * @return {Promise<File>}
 */
async function insert(repos, owner, name, description, storage_path, size, mimetype, virtual_folder) {
    const connection = await db();
    const res = await connection.query('INSERT INTO personal.storage (repos, owner, name, description, storage_path, size, mimetype, virtual_folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [repos, owner, name, description, storage_path, size, mimetype, virtual_folder]);
    await connection.end();
    return create(res.insertId);
}

module.exports = {create, insert};