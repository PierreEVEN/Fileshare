const db = require('../database')
const {gen_uid} = require("../uid_generator");
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
        this.description = data.description ? decodeURIComponent(data.description) : null;
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
        this.description = this.description ? this.description : '';
        assert(this.name);
        assert(!isNaN(this.owner));
        assert(this.status);
        assert(this.access_key);
        assert(this.max_file_size);
        assert(this.visitor_file_lifetime);
        assert(typeof this.allow_visitor_upload === 'boolean');
        await db.single().query(`INSERT INTO fileshare.repos
            (id, name, owner, description, status, access_key, max_file_size, visitor_file_lifetime, allow_visitor_upload) VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, name = $2, owner = $3, description = $4, status = $5, access_key = $6, max_file_size = $7, visitor_file_lifetime = $8, allow_visitor_upload = $9;`,
            [as_id(this.id), as_data_string(this.name), as_id(this.owner), as_data_string(this.description), as_enum(this.status), as_data_string(this.access_key), as_number(this.max_file_size), as_number(this.visitor_file_lifetime), as_boolean(this.allow_visitor_upload)]);
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
        for (const dir of await Directories.from_repos(this.id)) {
            dir.name = encodeURI(dir.name);
            dir.description = dir.description ? encodeURI(dir.description) : undefined;
            result.directories.push(dir);
        }
        for (const file of await File.from_repos(this.id)) {
            file.name = encodeURI(file.name);
            file.description = file.description ? encodeURI(file.description) : undefined;
            result.files.push(file);
        }

        return result;
    }

    async get_tree(partial = true) {
        const {directories, files} = await this.get_content()

        const root = {directories: [], files: [], name: encodeURI(this.name)}

        const dir_map = new Map();
        directories.forEach((dir) => {
            let dir_obj = {
                id: dir.id,
                name: dir.name,
                files: [],
                directories: [],
            };

            if (!partial) {
                dir_obj.owner = dir.owner;
                dir_obj.description = dir.description;
                dir_obj.is_special = dir.is_special;
                dir_obj.open_upload = dir.open_upload;
            }

            dir_map.set(dir.id, dir_obj);
        })

        directories.forEach((dir) => {
            if (!dir.parent_directory) {
                root.directories.push(dir_map.get(dir.id));
                return;
            }
            let parent = dir_map.get(dir.parent_directory);
            assert(parent);
            parent.directories.push(dir_map.get(dir.id));
        })

        files.forEach((file) => {
            const file_obj = {
                id: file.id,
                name: file.name,
                size: Number(file.size),
                timestamp: file.timestamp ? Number(file.timestamp) : undefined
            }
            if (!partial) {
                file_obj.owner = file.owner;
                file_obj.description = file.description;
                file_obj.mimetype = file.mimetype;
                file_obj.hash = file.hash;
            }
            if (!file.parent_directory) {
                root.files.push(file_obj);
                return;
            }
            let parent = dir_map.get(file.parent_directory);
            assert(parent);
            parent.files.push(file_obj);
        });

        return root;
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
        return await db.single().fetch_object(Repos, 'SELECT * FROM fileshare.repos WHERE id = $1', [as_id(id)]);
    }

    /**
     * @param name {string}
     * @param owner {User}
     * @return {Promise<Repos|null>}
     */
    static async from_name(name, owner) {
        assert(!isNaN(owner.id))
        return await db.single().fetch_object(Repos, 'SELECT * FROM fileshare.repos WHERE LOWER(name) = LOWER($1) AND owner = $2', [as_data_string(name), as_data_string(owner.id)]);
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
        await db.single().fetch_objects(Repos, 'SELECT * FROM fileshare.repos WHERE NOT owner = id AND id IN (SELECT id FROM fileshare.userrepos WHERE repos = $1 AND user = $2)', [as_id(this['id']), as_id(id)])
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