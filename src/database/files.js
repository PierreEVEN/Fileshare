const db = require('../database')

const fs = require('fs');
const path = require('path')
const fc = require('filecompare');
const {gen_uhash, gen_uid} = require("../uid_generator");
const assert = require("assert");

const id_base = new Set();

const STORAGE_PATH = path.resolve('data_storage')

class File {
    /**
     * @param data {Object}
     * @param file_path {string|null}
     */
    constructor(data, file_path = null) {
        this.id = data.id;
        this.repos = data.repos;
        this.owner = data.owner;
        this.directory = data.directory;
        this.name = data.name ? decodeURIComponent(data.name) : null;
        this.description = data.description ? decodeURIComponent(data.description) : null;
        this.size = data.size;
        this.mimetype = data.mimetype;
        this.hash = data.hash;
    }

    async push() {
        this.id = this.id || await File.gen_id()
        assert(this.repos);
        assert(this.owner);
        assert(this.directory);
        assert(this.name);
        assert(this.description);
        assert(this.size);
        assert(this.mimetype);
        assert(this.hash);
        const connection = await db();
        await connection.query(`REPLACE INTO Fileshare.Files
            (id, repos, owner, directory, name, description, size, mimetype, hash) VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [this.id, this.repos, this.owner, this.directory, encodeURIComponent(this.name), encodeURIComponent(this.description), this.size, this.mimetype, this.hash]);
        await connection.end();
        return this;
    }

    storage_path() {
        return path.join(STORAGE_PATH, this.id);
    }

    thumbnail_path() {
        return path.join(STORAGE_PATH, 'thumbnails', this.id);
    }

    async delete() {
        if (fs.existsSync(this.storage_path()))
            fs.unlinkSync(this.storage_path());

        if (fs.existsSync(this.thumbnail_path()))
            fs.unlinkSync(this.thumbnail_path());

        const connection = await db();
        await connection.query("DELETE FROM Fileshare.Files WHERE id = ?", [this.id]);
        await connection.end();
    }

    static async gen_id() {
        const connection = await db();
        const id = await gen_uhash(async (id) => Object(await connection.query('SELECT * FROM Fileshare.Files WHERE id = ?', [id])).length, id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<File|null>}
     */
    static async from_id(id) {
        const connection = await db();
        const found_data = Object.values(await connection.query('SELECT * FROM Fileshare.Files WHERE id = ?', [id]));
        const file = found_data.length === 1 ? new File(found_data[0]) : null;
        await connection.end();
        return file;
    }

    /**
     * @param hash
     * @param file_path
     * @param repos
     * @return {Promise<boolean>}
     */
    static async from_data(hash, file_path, repos) {
        const connection = await db();
        const file_with_same_hash = Object.values(await connection.query('SELECT * from Fileshare.Files WHERE repos = ? AND hash = ?', [id, hash]));
        await connection.end();

        for (const file of file_with_same_hash) {
            if (await new Promise((resolve) => {
                fc(file_path, file_with_same_hash[0].storage_path, (res) => resolve(res))
            }))
            return true;
        }
        return false;
    }

    /**
     * @param id {number}
     * @return {Promise<File[]>}
     */
    static async from_repos(id) {
        const connection = await db();
        const files = [];
        for (const file of Object.values(await connection.query('SELECT * from Fileshare.Files WHERE repos = ?', [id]))) {
            files.push(new File(file));
        }
        await connection.end();
        return files;
    }
}

module.exports = {File};