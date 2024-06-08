const db = require('./tools/database')
const {gen_uid} = require("./tools/uid_generator");
const {UserRepos} = require("./user_repos");
const assert = require("assert");
const {as_id, as_enum, as_boolean, as_number} = require("./tools/db_utils");
const {Item} = require("./item");
const {ServerString} = require("../server_string");

const id_base = new Set();

class Repos {
    /**
     * @param data {Object}
     */
    constructor(data) {
        /**
         * @type {number}
         */
        this.id = Number(data.id);
        /**
         * @type {ServerString}
         */
        this.description = ServerString.FromDB(data.description);
        /**
         * @type {ServerString}
         */
        this.name = ServerString.FromDB(data.name);
        /**
         * @type {ServerString}
         */
        this.display_name = ServerString.FromDB(data.display_name);
        /**
         * @type {number}
         */
        this.owner = Number(data.owner);
        /**
         * @type {string}
         */
        this.status = data.status.toString();
        /**
         * @type {number}
         */
        this.max_file_size = Number(data.max_file_size || 200 * 1024 * 1024);
        /**
         * @type {number}
         */
        this.visitor_file_lifetime = Number(data.visitor_file_lifetime || 604800);
        /**
         * @type {boolean}
         */
        this.allow_visitor_upload = data.allow_visitor_upload || false;
    }

    /**
     * Create or update repository
     * @return {Promise<Repos>}
     */
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
            [as_id(this.id), this.name.encoded(), as_id(this.owner), this.description.encoded(), as_enum(this.status), this.display_name.encoded(), as_number(this.max_file_size), as_number(this.visitor_file_lifetime), as_boolean(this.allow_visitor_upload)]);
        return this;
    }

    /**
     * Delete this item and all the content included
     * @return {Promise<void>}
     */
    async delete() {
        for (const item of await Item.from_repos(this.id)) {
            await item.delete();
        }

        for (const user_repos of await UserRepos.from_repos(this.id)) {
            await user_repos.delete();
        }

        await db.single().query("DELETE FROM fileshare.repos WHERE id = $1", [as_id(this.id)]);
    }

    /**
     * Will this object with required data for client // @TODO Improve this (temporary fix)
     * @return {Promise<Repos>}
     */
    async client_ready() {
        if (!this.username)
            for (const User of (await db.single().query("SELECT name FROM fileshare.users WHERE id = $1", [as_id(this.owner)])).rows)
                this.username = User.name;
        return this;
    }

    async get_content() {
        const content = await Item.from_repos(this.id);
        for (const item of content) //@TODO : optimize this step
            if (item.is_regular_file) {
                await item.as_file();
            }
            else
                await item.as_directory();
        return content;
    }

    /**
     * Create a new repos ID
     * @return {Promise<number>}
     */
    static async gen_id() {
        const connection = await db.persist();
        const id = await gen_uid(async (id) => await connection.found('SELECT * FROM fileshare.repos WHERE id = $1', [as_id(id)]), id_base);
        await connection.end();
        return id;
    }

    /**
     * Get repos data from ID
     * @param id {number} Directory id
     * @return {Promise<Repos|null>}
     */
    static async from_id(id) {
        assert(!isNaN(id))
        return await db.single().fetch_object(Repos, 'SELECT * FROM fileshare.repos WHERE id = $1', [as_id(id)]);
    }

    /**
     * Find repos by name
     * @param name {ServerString}
     * @param owner {User}
     * @return {Promise<Repos|null>}
     */
    static async from_name(name, owner) {
        assert(!isNaN(owner.id))
        return await db.single().fetch_object(Repos, 'SELECT * FROM fileshare.repos WHERE LOWER(name) = LOWER($1) AND owner = $2', [name.encoded(), as_id(owner.id)]);
    }

    /**
     * Find all repos possessed by a given user
     * @param id {number} user id
     * @return {Promise<Repos[]>}
     */
    static async from_owner(id) {
        assert(!isNaN(id))
        return await db.single().fetch_objects(Repos, `SELECT * FROM fileshare.repos WHERE owner = $1`, [as_id(id)])
    }

    /**
     * Get all repos visible to a given user
     * @param id {number} user id
     * @return {Promise<Repos[]>}
     */
    static async visible_to_user(id) {
        assert(!isNaN(id))
        await db.single().fetch_objects(Repos, 'SELECT * FROM fileshare.repos WHERE NOT owner = id AND id IN (SELECT id FROM fileshare.userrepos WHERE repos = $1 AND user = $2)', [as_id(this['id']), as_id(id)])
    }

    /**
     * Get all repos visible from anyone
     * @return {Promise<Repos[]>}
     */
    static async with_public_access() {
        return await db.single().fetch_objects(Repos, `SELECT * FROM fileshare.repos WHERE status = 'public'`);
    }

}

module.exports = {Repos};