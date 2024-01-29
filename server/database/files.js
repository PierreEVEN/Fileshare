const db = require('../database')

const fs = require('fs');
const path = require('path')
const fc = require('filecompare');
const {gen_uhash} = require("../uid_generator");
const assert = require("assert");
const {as_id, as_hash_key, as_data_string, as_number} = require("../db_utils");

const id_base = new Set();

class File {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.id = data.id;
        this.repos = data.repos;
        this.owner = data.owner;
        this.parent_directory = data.parent_directory;
        this.name = data.name ? decodeURIComponent(data.name) : null;
        this.description = data.description ? decodeURIComponent(data.description) : '';
        this.size = data.size;
        this.mimetype = decodeURIComponent(data.mimetype);
        this.hash = data.hash;
        this.timestamp = data.timestamp;
    }

    async push() {
        this.id = this.id || await File.gen_id()
        assert(this.repos);
        assert(this.owner);
        assert(this.name);
        assert(this.size);
        assert(this.mimetype);
        assert(this.hash);
        assert(this.timestamp);
        await db.single().query(`INSERT INTO fileshare.files
            (id, repos, owner, parent_directory, name, description, size, mimetype, hash, timestamp) VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, repos = $2, owner = $3, parent_directory = $4, name = $5, description = $6, size = $7, mimetype = $8, hash = $9, timestamp = $10;`,
            [as_hash_key(this.id), as_id(this.repos), as_id(this.owner), as_id(this.parent_directory), as_data_string(this.name), encodeURIComponent(this.description), as_number(this.size), as_data_string(this.mimetype), as_hash_key(this.hash), as_number(this.timestamp)]);
        return this;
    }

    storage_path() {
        return path.join(path.resolve(process.env.FILE_STORAGE_PATH), this.id);
    }

    thumbnail_path() {
        return path.join(path.resolve(process.env.FILE_STORAGE_PATH), 'thumbnails', this.id);
    }

    async delete() {
        if (fs.existsSync(this.storage_path()))
            fs.unlinkSync(this.storage_path());

        if (fs.existsSync(this.thumbnail_path()))
            fs.unlinkSync(this.thumbnail_path());

        await db.single().query("DELETE FROM fileshare.files WHERE id = $1", [as_data_string(this.id)]);
    }

    static async gen_id() {
        const connection = await db.persist();
        const id = await gen_uhash(async (id) => await connection.found('SELECT * FROM fileshare.files WHERE id = $1', [as_data_string(id)]), id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<File|null>}
     */
    static async from_id(id) {
        return await db.single().fetch_object(File, 'SELECT * FROM fileshare.files WHERE id = $1', [as_data_string(id)]);
    }

    /**
     * @param hash
     * @param file_path
     * @param repos
     * @return {Promise<File|null>}
     */
    static async from_data(hash, file_path, repos) {
        const file_with_same_hash = await db.single().rows('SELECT * from fileshare.files WHERE repos = $1 AND hash = $2', [as_id(repos), as_hash_key(hash)]);

        for (const file of file_with_same_hash) {
            if (await new Promise((resolve) => {
                fc(file_path, new File(file).storage_path(), (res) => resolve(res))
            }))
                return new File(file);
        }
        return null;
    }

    /**
     * @param id {number}
     * @return {Promise<File[]>}
     */
    static async from_repos(id) {
        return await db.single().fetch_objects(File, 'SELECT * FROM fileshare.files WHERE repos = $1', [as_id(id)]);
    }
}

module.exports = {File};