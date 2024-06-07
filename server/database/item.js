const db = require('../database')
const assert = require("assert");
const {as_data_string, as_id, as_enum, as_boolean, as_number, as_hash_key, as_data_path} = require("../db_utils");
const path = require("path");
const fc = require("filecompare");
const {logger} = require("../logger");

class Item {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.id = data.id;
        this.repos = data.repos;
        this.owner = data.owner;
        this.name = data.name;
        this.is_regular_file = data.is_regular_file;
        this.description = data.description;
        this.parent_item = data.parent_item ? data.parent_item : undefined;
        this.absolute_path = data.absolute_path;
        this.size = data.size;
        this.mimetype = data.mimetype;
        this.hash = data.hash;
        this.timestamp = data.timestamp;
        this.open_upload = data.open_upload;
    }

    async as_file() {
        assert(this.is_regular_file)
        if (this.size === undefined || !this.mimetype || !this.hash || this.timestamp) {
            const data = await db.single().fetch_row('SELECT * FROM fileshare.file_data WHERE id = $1', [as_number(this.id)]);
            if (!data)
                return null
            this.size = data.size;
            this.mimetype = data.mimetype;
            this.hash = data.hash;
            this.timestamp = data.timestamp;
        }
        return this;
    }

    async as_directory() {
        assert(!this.is_regular_file)
        if (this.size === undefined || !this.mimetype || !this.hash || this.timestamp) {
            const data = await db.single().fetch_row('SELECT * FROM fileshare.directory_data WHERE id = $1', [as_number(this.id)]);
            if (!data)
                return null
            this.open_upload = data.open_upload;
        }
        return this;
    }

    async push() {
        this.description = this.description ? this.description : '';
        assert(this.name);
        assert(this.repos);
        assert(!isNaN(Number(this.owner)));
        assert(this.name);
        assert(typeof this.is_regular_file === 'boolean');
        if (this.id) {
            await db.single().fetch_object(Item, `INSERT INTO fileshare.items
            (id, repos, owner, name, is_regular_file, description, parent_item) VALUES
            ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, repos = $2, owner = $3, name = $4, is_regular_file = $5, description = $6, parent_item = $7;`,
                [as_id(this.id), as_id(this.repos), as_id(this.owner), as_data_string(this.name), as_boolean(this.is_regular_file), as_data_string(this.description), this.parent_item ? as_id(this.parent_item) : null]);
        }
        else {
            const new_item = await db.single().query(`INSERT INTO fileshare.items
            (repos, owner, name, is_regular_file, description, parent_item) VALUES
            ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [as_id(this.repos), as_id(this.owner), as_data_string(this.name), as_boolean(this.is_regular_file), as_data_string(this.description), this.parent_item ? as_id(this.parent_item) : null]);
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
                [as_number(this.id), as_number(this.size), as_data_string(this.mimetype), as_hash_key(this.hash), as_number(this.timestamp)]);
        }
        else {
            assert(this.id !== undefined);
            if (typeof(this.open_upload) === 'boolean')
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

    async children(recursive = true) {
        if (this.is_regular_file)
            return [];
        const connection = await db.persist();
        let child_items = recursive ? await connection.fetch_objects(Item,'SELECT * FROM fileshare.items WHERE parent_item = $1', [as_id(this.id)]) : [];
        await connection.end();

        if (recursive)
            for (const item of child_items)
                child_items = child_items.concat(await item.children());

        return child_items;
    }

    storage_path() {
        assert(this.is_regular_file)
        return path.join(path.resolve(process.env.FILE_STORAGE_PATH), this.id.toString());
    }

    thumbnail_path() {
        assert(this.is_regular_file)
        return path.join(path.resolve(process.env.FILE_STORAGE_PATH), 'thumbnails', this.id);
    }

    /**
     * @param id {number} item id
     * @return {Item|null}
     */
    static async from_id(id) {
        return await db.single().fetch_object(Item, 'SELECT * FROM fileshare.items WHERE id = $1', [as_id(id)]);
    }

    /**
     * @return {Item|null}
     * @param repos {number}
     * @param path {string}
     */
    static async from_path(repos, path) {
        return await db.single().fetch_object(Item, 'SELECT * FROM fileshare.items WHERE  repos = $1 AND absolute_path = $2', [as_id(repos), as_data_path(path)]);
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<Item[]>}
     */
    static async from_repos(id) {
        return await db.single().fetch_objects(Item, 'SELECT * FROM fileshare.items WHERE repos = $1', [as_id(id)]);
    }

    /**
     * @param id {number} repos_id
     * @param directory_id {number}
     * @return {Promise<Item[]>}
     */
    static async inside_directory_recursive(id, directory_id) {
        const final_assets = []
        let search_items = await db.single().fetch_objects(Item, 'SELECT * FROM fileshare.items WHERE repos = $1 && parent_item = $2', [as_id(id), as_id(directory_id)]);

        do {
            const old_search_items = search_items;
            search_items = [];
            for (const item of old_search_items) {
                final_assets.push(item);
                if (!item.is_regular_file)
                    search_items = search_items.concat(await db.single().fetch_objects(Item, 'SELECT * FROM fileshare.items WHERE repos = $1 && parent_item = $2', [as_id(id), as_id(item.id)]));
            }
        } while (search_items.length !== 0);

        return final_assets;
    }

    /**
     * @return {Item|null}
     * @param repos {number}
     * @param absolute_path {string}
     * @param data {Object}
     */
    static async make_path_to_item(repos, absolute_path, data) {
        /**
         * @param repos {number}
         * @param path_split {string[]}
         * @returns {Item}
         * @private
         */
        const _internal = async (repos, path_split) => {
            if (path_split.length === 0)
                return null;

            const path = path_split.length === 0 ? '/' : `/${path_split.join('/')}/`;
            const dir = await Item.from_path(repos, path);
            if (dir)
                return dir;

            const name = path_split.pop();
            const parent = await _internal(repos, path_split);
            data.repos = repos;
            data.parent_item = parent ? parent.id : null;
            data.name = as_data_string(name);
            return await new Item(data).push();
        }

        return await _internal(repos, absolute_path.split('/').filter(Boolean));
    }

    /**
     * @param hash
     * @param file_path
     * @param repos
     * @return {Item|null}
     */
    static async from_data(hash, file_path, repos) {
        const file_with_same_hash = await db.single().rows('SELECT * from fileshare.file_data WHERE id IN (SELECT id FROM fileshare.items WHERE repos = $1) AND hash = $2', [as_id(repos), as_hash_key(hash)]);

        for (const file of file_with_same_hash) {
            let full_file = await Item.from_id(file.id);
            if (await new Promise(async (resolve) => {
                fc(file_path, full_file.storage_path(), (res) => resolve(res))
            })) {
                return await full_file.as_file();
            }
        }
        return null;
    }

    /**
     * @return {Promise<Item|null>}
     * @param repos {number}
     * @param absolute_path {string}
     * @param data {Object}
     */

    static async find_or_create_directory_from_path(repos, absolute_path, data) {
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
            return await new Item(data).push();
        }

        return await _internal(repos, absolute_path.split('/').filter(Boolean));
    }
}

module.exports = {Item}