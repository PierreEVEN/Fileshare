const db = require('./tools/database')
const assert = require("assert");
const {as_id, as_enum, as_boolean, as_number, as_hash_key, as_data_path} = require("./tools/db_utils");
const path = require("path");
const fc = require("filecompare");
const {ServerString} = require("../server_string");
const fs = require("node:fs");

class Item {
    /**
     * @param data {Object}
     */
    constructor(data) {
        /**
         * @type {number}
         */
        this.id = Number(data.id);
        /**
         * @type {number}
         */
        this.repos = Number(data.repos);
        /**
         * @type {number}
         */
        this.owner = Number(data.owner);
        /**
         * @type {ServerString}
         */
        this.name = ServerString.FromDB(data.name);
        /**
         * @type {boolean}
         */
        this.is_regular_file = data.is_regular_file;
        /**
         * @type {ServerString}
         */
        this.description = ServerString.FromDB(data.description);
        /**
         * @type {number|null}
         */
        this.parent_item = data.parent_item ? Number(data.parent_item) : undefined;
        /**
         * @type {ServerString}
         */
        this.absolute_path = ServerString.FromDB(data.absolute_path);
        /**
         * @type {number}
         */
        this.size = Number(data.size);
        /**
         * @type {ServerString}
         */
        this.mimetype = ServerString.FromDB(data.mimetype);
        /**
         * @type {string}
         */
        this.hash = data.hash ? data.hash.toString() : undefined;
        /**
         * @type {number}
         */
        this.timestamp = Number(data.timestamp);
        /**
         * @type {boolean}
         */
        this.open_upload = data.open_upload;
    }

    /**
     * Fetch file specific data
     * @return {Promise<Item|null>}
     */
    async as_file() {
        assert(this.is_regular_file)
        if (this.size === undefined || !this.mimetype || !this.hash || !this.timestamp) {
            const data = await db.single().fetch_row('SELECT * FROM fileshare.file_data WHERE id = $1', [as_number(this.id)]);
            if (!data)
                return null
            /**
             * @type {number}
             */
            this.size = data.size;
            /**
             * @type {ServerString}
             */
            this.mimetype = ServerString.FromDB(data.mimetype);
            /**
             * @type {string}
             */
            this.hash = data.hash;
            /**
             * @type {number}
             */
            this.timestamp = data.timestamp;
        }
        return this;
    }

    /**
     * Fetch directory specific data
     * @return {Promise<Item|null>}
     */
    async as_directory() {
        assert(!this.is_regular_file)
        if (this.size === undefined || !this.mimetype || !this.hash || !this.timestamp) {
            const data = await db.single().fetch_row('SELECT * FROM fileshare.directory_data WHERE id = $1', [as_number(this.id)]);
            if (!data)
                return null
            /**
             * @type {boolean}
             */
            this.open_upload = data.open_upload;
        }
        return this;
    }

    /**
     * Create or update item
     * @return {Promise<Item>}
     */
    async push() {
        this.description = this.description ? this.description : '';
        assert(this.name);
        assert(this.repos);
        assert(!isNaN(Number(this.owner)));
        assert(typeof this.is_regular_file === 'boolean');
        if (this.id) {
            await db.single().fetch_object(Item, `INSERT INTO fileshare.items
            (id, repos, owner, name, is_regular_file, description, parent_item) VALUES
            ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, repos = $2, owner = $3, name = $4, is_regular_file = $5, description = $6, parent_item = $7;`,
                [as_id(this.id), as_id(this.repos), as_id(this.owner), this.name.encoded(), as_boolean(this.is_regular_file), this.description.encoded(), this.parent_item ? as_id(this.parent_item) : null]);
        } else {
            const new_item = await db.single().query(`INSERT INTO fileshare.items
            (repos, owner, name, is_regular_file, description, parent_item) VALUES
            ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [as_id(this.repos), as_id(this.owner), this.name.encoded(), as_boolean(this.is_regular_file), this.description.encoded(), this.parent_item ? as_id(this.parent_item) : null]);
            this.id = new_item.rows[0].id;
        }
        if (this.is_regular_file) {
            assert(this.id !== undefined);
            assert(this.size !== undefined);
            assert(this.mimetype);
            assert(this.hash !== undefined);
            assert(this.timestamp !== undefined);
            await db.single().query(`INSERT INTO fileshare.file_data
                (id, size, mimetype, hash, timestamp) VALUES
                ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO
                UPDATE SET id = $1, size = $2, mimetype = $3, hash = $4, timestamp = $5;`,
                [as_number(this.id), as_number(this.size), this.mimetype.encoded(), as_hash_key(this.hash), as_number(this.timestamp)]);
        } else {
            assert(this.id !== undefined);
            if (typeof (this.open_upload) === 'boolean')
                this.open_upload = false;
            await db.single().query(`INSERT INTO fileshare.directory_data
                (id, open_upload) VALUES
                ($1, $2)
                ON CONFLICT (id) DO  
                UPDATE SET id = $1, open_upload = $2;`,
                [as_number(this.id), as_boolean(this.open_upload)]);
        }
        return this;
    }

    /**
     * Delete this item and all the content included
     * @return {Promise<void>}
     */
    async delete() {
        for (const file of await db.single().fetch_objects(Item, "SELECT * FROM fileshare.items WHERE parent_item = $1", [as_id(this.id)])) {
            await file.delete();
        }

        if (this.is_regular_file)
            await db.single().query("DELETE FROM fileshare.file_data WHERE id = $1", [as_id(this.id)])
        else
            await db.single().query("DELETE FROM fileshare.directory_data WHERE id = $1", [as_id(this.id)])

        await db.single().query("DELETE FROM fileshare.items WHERE id = $1", [as_id(this.id)]);
    }

    storage_path() {
        assert(this.is_regular_file)
        return path.join(path.resolve(process.env.FILE_STORAGE_PATH), this.id.toString());
    }

    thumbnail_path() {
        assert(this.is_regular_file)
        return path.join(path.resolve(process.env.FILE_STORAGE_PATH), 'thumbnails', this.id.toString());
    }

    /**
     @return {Promise<Item[]>}
     */
    async get_files_inside_recursive() {
        assert(typeof this.absolute_path.plain() === 'string' && this.absolute_path.plain() !== '');
        return await db.single().fetch_objects(Item, `SELECT * FROM fileshare.items WHERE repos = $1 AND is_regular_file = 'yes' AND STARTS_WITH(absolute_path, $2)`, [this.repos, this.absolute_path.encoded()]);
    }

    /**
     * Find item from ID
     * @param id {number} item id
     * @return {Item|null}
     */
    static async from_id(id) {
        return await db.single().fetch_object(Item, 'SELECT * FROM fileshare.items WHERE id = $1', [as_id(id)]);
    }

    /**
     * Find item from path inside a given repository
     * @return {Item|null}
     * @param repos {number}
     * @param path {string}
     */
    static async from_path(repos, path) {
        return await db.single().fetch_object(Item, 'SELECT * FROM fileshare.items WHERE repos = $1 AND absolute_path = $2', [as_id(repos), as_data_path(path)]);
    }

    /**
     * Get a list of files inside a repository
     * @param id {number} repos_id
     * @return {Promise<Item[]>}
     */
    static async from_repos(id) {
        return await db.single().fetch_objects(Item, 'SELECT item.*, file.size, file.mimetype, file.hash, file.timestamp, directory.open_upload FROM fileshare.items item LEFT JOIN fileshare.file_data file ON item.id = file.id LEFT JOIN fileshare.directory_data directory ON item.id = directory.id WHERE repos = $1', [as_id(id)]);
    }

    /**
     * Find file item from data (used to find duplications)
     * @param hash {string}
     * @param file_path {string}
     * @param repos {number}
     * @return {Promise<Item|null>}
     */
    static async from_data(hash, file_path, repos) {
        const file_with_same_hash = await db.single().rows('SELECT * from fileshare.file_data WHERE id IN (SELECT id FROM fileshare.items WHERE repos = $1) AND hash = $2', [as_id(repos), as_hash_key(hash)]);

        for (const file of file_with_same_hash) {
            let full_file = await Item.from_id(file.id);
            if (full_file.size === 0)
                continue;
            if (!fs.existsSync(full_file.storage_path())) {
                console.error(`Cannot find stored file ${full_file.storage_path()} (${full_file.name}) #4897865`)
                continue;
            }
            if (await new Promise(async (resolve) => {
                fc(file_path, full_file.storage_path(), (res) => resolve(res))
            })) {
                return await full_file.as_file();
            }
        }
        return null;
    }

    /**
     * @return {Promise<{wanted_directory:Item, created_directories:Item[]}|null>}
     * @param repos {number}
     * @param absolute_path {string}
     * @param data {Object}
     */
    static async find_or_create_directory_from_path(repos, absolute_path, data) {

        const created_directories = [];

        /**
         @param repos {number}
         @param path_split {string[]}
         @returns {Promise<Item>}
         @private
         */
        const _internal = async (repos, path_split) => {
            if (path_split.length === 0)
                return null;

            const path = path_split.length === 0 ? '/' : `/${path_split.join('/')}/`;
            const existing_dir = await Item.from_path(repos, path);
            if (existing_dir) {
                if (existing_dir.is_regular_file)
                    throw Error(`Object ${JSON.stringify(existing_dir)} is not a directory`);
                return existing_dir;
            }

            const name = path_split.pop();
            const parent = await _internal(repos, path_split);
            data.repos = repos;
            data.parent_item = parent ? parent.id : null;
            data.name = encodeURIComponent(name);
            data.is_regular_file = false;
            const created_dir = await new Item(data).push();
            created_directories.push(created_dir);
            return created_dir;
        }

        return {
            wanted_directory: await _internal(repos, absolute_path.split('/').filter(Boolean)),
            created_directories: created_directories
        };
    }

    /**
     * @param repos_id {number}
     * @param owner_id {number}
     * @param parent {Item|null} Parent directory
     * @param name {ServerString}
     * @param open_upload {Boolean}
     * @return {Promise<Item>}
     * @constructor
     */
    static async create_directory(repos_id, owner_id, parent, name, open_upload) {
        const data = {};
        data.owner = owner_id;
        data.repos = repos_id;
        data.parent_item = parent ? parent.id : null;
        data.name = name.encoded();
        data.open_upload = open_upload;
        data.is_regular_file = false;
        try {
            return await new Item(data).push();
        }
        catch (e) {
            return null;
        }
    }
}

module.exports = {Item}