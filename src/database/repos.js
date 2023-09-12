const db = require('../database')
const {logger} = require("../logger");
const {gen_uid, gen_uhash} = require("../uid_generator");
const {File} = require('./files')
const {UserRepos} = require("./user_repos");
const assert = require("assert");
const {Directories} = require("./directories");

const id_base = new Set();

class Repos {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.id = data.id;
        this.name = data.name ? decodeURIComponent(data.name) : null;
        this.owner = data.owner;
        this.status = data.status;
        this.access_key = data.access_key ? decodeURIComponent(data.access_key) : null;
        this.max_file_size = data.max_file_size || 200 * 1024 * 1024;
        this.visitor_file_lifetime = data.visitor_file_lifetime || 604800;
        this.allow_visitor_upload = data.allow_visitor_upload || false;
    }

    async push() {
        this.id = this.id || await Repos.gen_id()
        assert(this.name);
        assert(this.owner && typeof this.owner === 'bigint');
        assert(this.status);
        assert(this.access_key);
        assert(this.max_file_size);
        assert(this.visitor_file_lifetime);
        assert(this.allow_visitor_upload !== undefined && this.allow_visitor_upload !== null);
        const connection = await db();
        await connection.query(`REPLACE INTO Fileshare.Repos
            (id, name, owner, status, access_key, max_file_size, visitor_file_lifetime, allow_visitor_upload) VALUES
            (?, ?, ?, ?, ?, ?, ?, ?);`,
            [this.id, encodeURIComponent(this.name), this.owner, this.status.toLowerCase().trim(), encodeURIComponent(this.access_key), this.max_file_size, this.visitor_file_lifetime, this.allow_visitor_upload]);
        await connection.end();
        return this;
    }

    async delete() {
        for (const file of await File.from_repos(this.id)) {
            await file.delete();
        }

        const connection = await db();
        await connection.query("DELETE FROM Fileshare.Repos WHERE id = ?", [this.id]);
        await connection.end();
    }

    async can_user_read_repos(user) {
        if (this.status !== 'private')
            return true;

        if (!user)
            return false;

        if (this.owner === user)
            return true;

        return await UserRepos.exists(user, this.id) !== null;
    }

    can_user_edit_repos(user) {
        return user && this.owner === user;
    }

    async get_content() {
        const result = {
            directories: [],
            files: [],
        };
        for (const dir of await Directories.from_repos(this.id))
            result.directories.push(dir);
        for (const file of await File.from_repos(this.id))
            result.files.push(file);
        return result;
    }

    static async gen_id() {
        const connection = await db();
        const id = await gen_uid(async (id) => Object(await connection.query('SELECT * FROM Fileshare.Repos WHERE id = ?', [id])).length, id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<Repos|null>}
     */
    static async from_id(id) {
        assert(typeof id === 'bigint')
        const connection = await db();
        const found_data = Object.values(await connection.query('SELECT * FROM Fileshare.Repos WHERE id = ?', [id]));
        const repos = found_data.length === 1 ? new Repos(found_data[0]) : null;
        await connection.end();
        return repos;
    }

    /**
     * @param id {number} user id
     * @return {Promise<Repos[]>}
     */
    static async from_owner(id) {
        assert(typeof id === 'bigint')
        const connection = await db();
        const repos = []
        for (const repo of Object.values(await connection.query('SELECT * FROM Fileshare.Repos WHERE owner = ?', [id])))
            repos.push(repo);
        await connection.end();
        return repos;
    }

    /**
     * @param id {number} user id
     * @return {Promise<Repos[]>}
     */
    static async visible_to_user(id) {
        assert(typeof id === 'bigint')
        const connection = await db();
        const repos = []
        for (const repo of Object.values(await connection.query('SELECT * FROM Fileshare.Repos WHERE NOT owner = id AND id IN (SELECT id FROM Fileshare.UserRepos WHERE repos = ? AND user = ?)', [this.id, id])))
            repos.push(repo);
        await connection.end();
        return repos;
    }

    /**
     * @return {Promise<Repos[]>}
     */
    static async with_public_access() {
        const connection = await db();
        const repos = []
        for (const repo of Object.values(await connection.query('SELECT * FROM Fileshare.Repos WHERE status = "public"')))
            repos.push(repo);
        await connection.end();
        return repos;
    }

    /**
     * @param key {string} Directory id
     * @return {Promise<Repos|null>}
     */
    static async from_access_key(key) {
        assert(typeof key === 'string')
        const connection = await db();
        const found_data = Object.values(await connection.query('SELECT * FROM Fileshare.Repos WHERE access_key = ?', [encodeURIComponent(key)]));
        const repos = found_data.length === 1 ? new Repos(found_data[0]) : null;
        await connection.end();
        return repos;
    }
}

module.exports = {Repos};