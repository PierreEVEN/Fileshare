const db = require('../database')
const {logger} = require("../logger");
const {gen_uid, gen_uhash} = require("../uid_generator");
const {File} = require('./files')
const {UserRepos} = require("./user_repos");
const assert = require("assert");
const {Directories} = require("./directories");
const {as_data_string, as_id, as_enum, as_boolean, as_number} = require("../db_utils");

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
        assert(!isNaN(this.owner));
        assert(this.status);
        assert(this.access_key);
        assert(this.max_file_size);
        assert(this.visitor_file_lifetime);
        assert(this.allow_visitor_upload !== undefined && this.allow_visitor_upload !== null);
        await db.single().query(`INSERT INTO fileshare.repos
            (id, name, owner, status, access_key, max_file_size, visitor_file_lifetime, allow_visitor_upload) VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, name = $2, owner = $3, status = $4, access_key = $5, max_file_size = $6, visitor_file_lifetime = $7, allow_visitor_upload = $8;`,
            [as_id(this.id), as_data_string(this.name), as_id(this.owner), as_enum(this.status), as_data_string(this.access_key), as_number(this.max_file_size), as_number(this.visitor_file_lifetime), as_boolean(this.allow_visitor_upload)]);
        return this;
    }

    async delete() {
        for (const file of await File.from_repos(this.id)) {
            await file.delete();
        }

        console.error("Don't use directory here")
        for (const directory of await Directories.from_repos(this.id)) {
            await directory.delete();
        }

        for (const user_repos of await UserRepos.from_repos(this.id)) {
            await user_repos.delete();
        }

        await db.single().query("DELETE FROM fileshare.repos WHERE id = $1", [as_id(this.id)]);
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
        const connection = await db.persist();
        const id = await gen_uid(async (id) => await connection.found('SELECT * FROM fileshare.repos WHERE id = $1', [as_id(id)]), id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<Repos|null>}
     */
    static async from_id(id) {
        assert(!isNaN(id))
        return await db.single().fetch_object(File, 'SELECT * FROM fileshare.repos WHERE id = $1', [as_id(id)]);
    }

    /**
     * @param id {number} user id
     * @return {Promise<Repos[]>}
     */
    static async from_owner(id) {
        assert(!isNaN(id))
        return await db.single().fetch_objects(Repos, `SELECT * FROM fileshare.repos WHERE owner = $1`, [as_id(id)])
    }

    /**
     * @param id {number} user id
     * @return {Promise<Repos[]>}
     */
    static async visible_to_user(id) {
        assert(!isNaN(id))
        await db.single().fetch_objects(Repos, 'SELECT * FROM fileshare.repos WHERE NOT owner = id AND id IN (SELECT id FROM fileshare.userrepos WHERE repos = $1 AND user = $2)', [as_id(this.id), as_id(id)])
    }

    /**
     * @return {Promise<Repos[]>}
     */
    static async with_public_access() {
        return await db.single().fetch_objects(Repos, `SELECT * FROM fileshare.repos WHERE status = 'public'`);
    }

    /**
     * @param key {string} Directory id
     * @return {Promise<Repos|null>}
     */
    static async from_access_key(key) {
        assert(typeof key === 'string')
        return await db.single().fetch_object(Repos, 'SELECT * FROM fileshare.repos WHERE access_key = $1', [as_data_string(key)]);
    }
}

module.exports = {Repos};