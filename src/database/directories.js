const db = require("../database");
const {gen_uid} = require("../uid_generator");
const assert = require("assert");
const fs = require("fs");
const {File} = require('./files')
const {Repos} = require("./repos");

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

        const connection = await db();
        await connection.query(`SET FOREIGN_KEY_CHECKS = 0;`);
        await connection.query(`REPLACE INTO Fileshare.Directories
            (id, repos, owner, name, description, is_special, parent_directory, open_upload) VALUES
            (?, ?, ?, ?, ?, ?, ?, ?);`,
            [this.id, this.repos, this.owner, encodeURIComponent(this.name), encodeURIComponent(this.description), this.is_special, this.parent_directory, this.open_upload]);
        await connection.query(`SET FOREIGN_KEY_CHECKS = 1;`);
        await connection.end();
        return this;
    }

    async delete() {
        let connection = await db();
        for (const file of Object.values(await connection.query("SELECT * FROM Fileshare.Files WHERE parent_directory = ?", [this.id]))) {
            await new File(file).delete();
        }

        const inner_dirs = Object.values(await connection.query("SELECT * FROM Fileshare.Directories WHERE parent_directory = ?", [this.id]));
        await connection.end();
        for (const inner_dir of inner_dirs) {
            await new Directories(inner_dir).delete();
        }

        connection = await db();
        await connection.query("DELETE FROM Fileshare.Directories WHERE id = ?", [this.id]);
        await connection.end();
    }

    async can_user_view_directory(user_id) {
        if (!user_id)
            return false

        // The people who created the directory can always edit or delete it
        if (this.owner === user_id)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(this.repos);
        return repos.can_user_view_repos(user_id);
    }

    async can_user_upload_to_directory(user_id) {
        if (!user_id)
            return false;

        // The people who created the directory can always edit or delete it
        if (this.owner === user_id)
            return true;

        if (this.open_upload)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(this.repos);
        return repos.can_user_upload_to_repos(user_id);
    }

    async can_user_edit_directory(user_id) {
        if (!user_id)
            return false;

        // The people who created the directory can always edit or delete it
        if (this.owner === user_id)
            return true;

        // The people who have admin right on the repos can edit or delete the directory as well
        const repos = await Repos.from_id(this.repos);
        return repos.can_user_edit_repos(user_id);
    }

    async get_absolute_path() {
        if (this.parent_directory)
            return await (await Directories.from_id(this.parent_directory)).get_absolute_path() + `${this.name}/`;

        return `/${this.name}/`;
    }

    async get_files(recursive = true) {
        let files = [];
        const connection = await db();
        for (const file of Object.values(await connection.query('SELECT * FROM Fileshare.Files WHERE parent_directory = ?', [this.id])))
            files.push(new File(file));

        console.log(files)

        let child_dirs = []
        if (recursive)
            for (const file of Object.values(await connection.query('SELECT * FROM Fileshare.Directories WHERE parent_directory = ?', [this.id])))
                child_dirs.push(new Directories(file));
        await connection.end();

        for (const dir of child_dirs)
            files = files.concat(await dir.get_files());

        return files;
    }

    static async gen_id() {
        const connection = await db();
        const id = await gen_uid(async (id) => Object(await connection.query('SELECT * FROM Fileshare.Directories WHERE id = ?', [id])).length, id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<Directories|null>}
     */
    static async from_id(id) {
        const connection = await db();
        const found_data = Object.values(await connection.query('SELECT * FROM Fileshare.Directories WHERE id = ?', [id]));
        const directory = found_data.length === 1 ? new Directories(found_data[0]) : null;
        await connection.end();
        return directory;
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
            base = await Directories.inside_dir(base, name, repos);
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
        const connection = await db();
        const found_data = parent ?
            Object.values(await connection.query('SELECT * FROM Fileshare.Directories WHERE parent_directory = ? AND name = ? AND repos = ?', [parent, encodeURIComponent(name), repos])) :
            Object.values(await connection.query('SELECT * FROM Fileshare.Directories WHERE parent_directory IS NULL AND name = ? AND repos = ?', [encodeURIComponent(name), repos]));
        const directory = found_data.length >= 1 ? new Directories(found_data[0]) : null;
        await connection.end();
        return directory;
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<Directories[]>}
     */
    static async from_repos(id) {
        const connection = await db();
        const directories = [];
        for (const dir of Object.values(await connection.query('SELECT * FROM Fileshare.Directories WHERE repos = ?', [id])))
            directories.push(new Directories(dir));
        await connection.end();
        return directories;
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