const db = require("../database");
const {gen_uid} = require("../uid_generator");
const assert = require("assert");

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
        this.description = data.description ? decodeURIComponent(data.description) : null;
        this.is_special = data.is_special;
        this.parent_directory = data.parent_directory;
    }

    async push() {
        assert(this.id);
        assert(this.repos);
        assert(this.owner);
        assert(this.name);
        assert(this.description);
        assert(this.is_special);
        assert(this.parent_directory);
        const connection = await db();
        await connection.query(`REPLACE INTO Fileshare.Directories
            (id, repos, owner, name, description, is_special, parent_directory) VALUES
            (?, ?, ?, ?, ?, ?, ?);`,
            [this.id || await Directories.gen_id(), this.repos, this.owner, encodeURIComponent(this.name), encodeURIComponent(this.description), this.is_special, this.parent_directory]);
        await connection.end();
        return this;
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
}

module.exports = {Directories}