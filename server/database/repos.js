const db = require('../database')
const {gen_uid} = require("../uid_generator");
const {UserRepos} = require("./user_repos");
const assert = require("assert");
const {as_data_string, as_id, as_enum, as_boolean, as_number} = require("../db_utils");
const {Item} = require("./item");

const id_base = new Set();

class Repos {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.id = data.id;
        this.description = data.description ? decodeURIComponent(data.description) : null;
        this.name = data.name ? decodeURIComponent(data.name) : null;
        this.display_name = data.display_name ? decodeURIComponent(data.display_name) : null;
        this.owner = data.owner;
        this.status = data.status;
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
        assert(this.display_name);
        assert(this.max_file_size);
        assert(this.visitor_file_lifetime);
        assert(typeof this.allow_visitor_upload === 'boolean');
        await db.single().query(`INSERT INTO fileshare.repos
            (id, name, owner, description, status, display_name, max_file_size, visitor_file_lifetime, allow_visitor_upload) VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, name = $2, owner = $3, description = $4, status = $5, display_name = $6, max_file_size = $7, visitor_file_lifetime = $8, allow_visitor_upload = $9;`,
            [as_id(this.id), as_data_string(this.name), as_id(this.owner), as_data_string(this.description), as_enum(this.status), as_data_string(this.display_name), as_number(this.max_file_size), as_number(this.visitor_file_lifetime), as_boolean(this.allow_visitor_upload)]);
        return this;
    }

    async delete() {
        for (const item of await Item.from_repos(this.id)) {
            await item.delete();
        }

        for (const user_repos of await UserRepos.from_repos(this.id)) {
            await user_repos.delete();
        }

        await db.single().query("DELETE FROM fileshare.repos WHERE id = $1", [as_id(this.id)]);
    }

    async client_ready() {
        if (!this.username)
            for (const User of (await db.single().query("SELECT name FROM fileshare.users WHERE id = $1", [as_id(this.owner)])).rows)
                this.username = User.name;
        return this;
    }

    async get_tree(initial_path) {
        console.warn("TODO : handle path properly")
        const data = await Item.from_repos(this.id);

        const roots = [];

        const directories = new Map();
        for (const item of data) {
            if (!item.is_regular_file)
                item.children = [];
            directories.set(item.id, item);
        }

        for (const item of data)
            if (!item.parent_item)
                roots.push(item);
            else
                directories[item.parent_item].children.push(item)

        return roots;
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

}

module.exports = {Repos};