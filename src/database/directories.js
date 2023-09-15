const db = require("../database");
const {gen_uid} = require("../uid_generator");
const assert = require("assert");
const {File} = require('./files');
const {as_id, as_data_string, as_boolean} = require("../db_utils");

const id_base = new Set();

class Directories {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.id = data.id;
        this.repos = data.repos;
        this.owner = data.owner;
        this.name = data.name ? decodeURIComponent(data.name) : null;
        this.description = data.description ? decodeURIComponent(data.description) : '';
        this.is_special = data.is_special || false;
        this.parent_directory = data.parent_directory || null;
        this.open_upload = data.open_upload || false;
    }

    async push() {
        this.id = this.id || await Directories.gen_id();
        assert(this.repos);
        assert(this.owner);
        assert(this.name);
        assert(typeof this.is_special === 'boolean');
        assert(typeof this.open_upload === 'boolean');

        await db.single().query(`INSERT INTO fileshare.directories
            (id, repos, owner, name, description, is_special, parent_directory, open_upload) VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, repos = $2, owner = $3, name = $4, description = $5, is_special = $6, parent_directory = $7, open_upload = $8;`,
            [as_id(this.id), as_id(this.repos), as_id(this.owner), as_data_string(this.name), as_data_string(this.description), as_boolean(this.is_special), as_id(this.parent_directory), as_boolean(this.open_upload)]);
        return this;
    }

    async delete() {
        let connection = await db.persist();

        for (const file of await connection.fetch_objects(File, "SELECT * FROM fileshare.files WHERE parent_directory = $1", [as_id(this.id)])) {
            await file.delete();
        }

        const inner_dirs = await connection.fetch_objects(Directories,"SELECT * FROM fileshare.directories WHERE parent_directory = $1", [as_id(this.id)]);
        await connection.end();
        for (const inner_dir of inner_dirs) {
            await inner_dir.delete();
        }

        await db.single().query("DELETE FROM fileshare.directories WHERE id = $1", [as_id(this.id)]);
    }

    async get_absolute_path() {
        if (this.parent_directory)
            return await (await Directories.from_id(this.parent_directory)).get_absolute_path() + `${this.name}/`;

        return `/${this.name}/`;
    }

    async get_files(recursive = true) {
        const connection = await db.persist();
        let files = await connection.fetch_objects(File, 'SELECT * FROM fileshare.files WHERE parent_directory = $1', [as_id(this.id)]);

        let child_dirs = recursive ? await connection.fetch_objects(Directories,'SELECT * FROM fileshare.directories WHERE parent_directory = $1', [as_id(this.id)]) : [];
        await connection.end();

        for (const dir of child_dirs)
            files = files.concat(await dir.get_files());

        return files;
    }

    static async gen_id() {
        const connection = await db.persist();
        const id = await gen_uid(async (id) => await connection.found('SELECT * FROM fileshare.directories WHERE id = $1', [as_id(id)]), id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<Directories|null>}
     */
    static async from_id(id) {
        return await db.single().fetch_object(Directories, 'SELECT * FROM fileshare.directories WHERE id = $1', [as_id(id)]);
    }

    /**
     * @return {Promise<Directories|null>}
     * @param repos {number}
     * @param path {string}
     */
    static async from_path(repos, path) {
        const path_list = path.split('/').filter(Boolean)
        let base = null;
        while (path_list.length > 0) {
            const name = path_list.shift();
            base = await Directories.inside_dir(base ? base.id : null, name, repos);
        }
        return base;
    }

    /**
     * @param parent {number | null} Parent directory id
     * @param name {string} Directory name
     * @param repos {number} Repos id
     * @return {Promise<Directories|null>}
     */
    static async inside_dir(parent, name, repos) {
        return parent ?
            await db.single().fetch_object(Directories, 'SELECT * FROM fileshare.Directories WHERE parent_directory = $1 AND name = $2 AND repos = $3', [as_id(parent), as_data_string(name), as_id(repos)]) :
            await db.single().fetch_object(Directories, 'SELECT * FROM fileshare.directories WHERE parent_directory IS NULL AND name = $1 AND repos = $2', [as_data_string(name), as_id(repos)]);
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<Directories[]>}
     */
    static async from_repos(id) {
        return await db.single().fetch_objects(Directories, 'SELECT * FROM fileshare.directories WHERE repos = $1', [as_id(id)]);
    }

    /**
     * @return {Promise<Directories|null>}
     * @param repos {number}
     * @param absolute_path {string}
     * @param data {Object}
     */
    static async find_or_create(repos, absolute_path, data) {
        /**
         * @param repos {number}
         * @param path_split {string[]}
         * @returns {Promise<Directories>}
         * @private
         */
        const _internal = async (repos, path_split) => {
            if (path_split.length === 0)
                return null;

            const path = path_split.length === 0 ? '/' : `/${path_split.join('/')}/`;
            const dir = await Directories.from_path(repos, path);
            if (dir)
                return dir;

            const name = path_split.pop();
            const parent = await _internal(repos, path_split);
            data.repos = repos;
            data.parent_directory = parent ? parent.id : null;
            data.name = name;
            return await new Directories(data).push();
        }

        return await _internal(repos, absolute_path.split('/').filter(Boolean));
    }
}

module.exports = {Directories}