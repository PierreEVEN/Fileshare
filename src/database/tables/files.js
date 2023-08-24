const db = require('./../../../database')

const Storage = require('../storage');
const repos = require('./repos');
const user = require('./user');
const crypto = require("crypto");
const fs = require('fs');
const path = require('path')

const files_storage = new Storage();

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

    /**
     * @return {Promise<string>}
     */
    async get_hash() {
        if (!this._hash)
            await this._update_data_internal()
        return this._hash;
    }

    async delete() {

        fs.unlinkSync(path.resolve(await this.get_storage_path()));

        const connection = await db();
        await connection.query("DELETE FROM Personal.Files WHERE id = ?", [this._id]);
        await connection.end();

        files_storage.clear(this._id);
    }

    async _update_data_internal(query_result = null) {
        let result = query_result;

        if (!result) {
            const connection = await db();
            const found_data = Object.values(await connection.query('SELECT * FROM Personal.Files WHERE id = ?', [this._id]));
            if (found_data.length > 0)
                result = found_data[0];
            await connection.end();
        }

        if (result) {
            this._repos = repos.find(result.repos);
            this._owner = user.find(result.owner);
            this._name = result.name;
            this._description = result.description;
            this._storage_path = result.storage_path;
            this._size = result.size;
            this._mimetype = result.mimetype;
            this._virtual_folder = result.virtual_folder;
            this._hash = result.hash;
        } else {
            throw new Error(`Failed to get files id '${this._id}'`);
        }
    }
}

async function init_table() {

    const connection = await db();
    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Files'")).length === 0) {
        await connection.query(`CREATE TABLE Personal.Files (
                id varchar(200) PRIMARY KEY,
                repos int NOT NULL,
                owner int NOT NULL,
                name varchar(200) NOT NULL,
                description varchar(1200),
                storage_path varchar(200) NOT NULL UNIQUE,
                size int NOT NULL,
                mimetype varchar(200) NOT NULL,
                virtual_folder varchar(200) NOT NULL,
                hash varchar(64) NOT NULL,
                FOREIGN KEY(Repos) REFERENCES Personal.Repos(id),
                FOREIGN KEY(owner) REFERENCES Personal.Users(id)
        );`)
    }

    await connection.end();
}

const table_created = init_table();

/**
 * @return {File}
 */
async function find(id) {
    return await table_created.then(async () => {
        let file = files_storage.find(id);
        if (!file) {
            const connection = await db();
            const new_result = Object.values(await connection.query('SELECT * FROM Personal.Files WHERE id = ?', [id]))
            await connection.end();
            if (new_result.length > 0) {
                file = new File(id);
                await file._update_data_internal(new_result[0]);
                files_storage.add(id, file);
            }
        }
        return file;
    });
}

/**
 * @return {Promise<boolean>}
 */
async function already_exists(file_path, file_hash) {
    const connection = await db();
    const file_with_same_hash = Object.values(await connection.query('SELECT * from Personal.Files WHERE hash = ?', [file_hash]));
    await connection.end();

    if (file_with_same_hash.length > 0) {
        const tmp_buffer = fs.readFileSync(file_path);
        const existing_buffer = fs.readFileSync(file_with_same_hash[0].storage_path);

        return tmp_buffer.equals(existing_buffer);
    }


    return false;
}


    /**
 * @return {Promise<File>}
 */
async function insert(old_file_path, repos, owner, name, description, mimetype, virtual_folder) {

    const fileBuffer = fs.readFileSync(old_file_path);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const file_hash = hashSum.digest('hex');

    if (await already_exists(old_file_path, file_hash))
        return null;

    return await table_created.then(async () => {
        // Generate ID
        const connection = await db();

        let file_id = null;
        do {
            file_id = crypto.randomBytes(16).toString("hex");
        }
        while (Object.entries(await connection.query('SELECT * FROM Personal.Files WHERE id = ?', [file_id])).length > 0);
        const storage_path = `./data_storage/${file_id}`

        const file_data = fs.statSync(old_file_path)
        const res = await connection.query('INSERT INTO Personal.Files (id, repos, owner, name, description, storage_path, size, mimetype, virtual_folder, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [file_id, repos.get_id(), owner.get_id(), name, description, storage_path, file_data.size, mimetype, virtual_folder, file_hash]);

        fs.renameSync(old_file_path, storage_path)

        await connection.end();
        return find(Number(res.insertId));
    })
}


module.exports = {find, insert};