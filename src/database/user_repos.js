const db = require('../database')
const assert = require("assert");
const {File} = require("./files");

const id_base = new Set();

class UserRepos {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.owner = data.owner;
        this.repos = data.repos;
        this.access_type = data.access_type;
    }

    can_edit() {
        return this.access_type === 'moderator';
    }

    can_upload() {
        return this.access_type === 'contributor' || this.access_type === 'moderator';
    }

    async push() {
        assert(this.owner);
        assert(this.repos);
        assert(this.access_type);
        const connection = await db();
        await connection.query(`REPLACE INTO Fileshare.UserRepos
            (owner, repos, access_type) VALUES
            (?, ?, ?);`,
            [this.owner, this.repos, this.access_type.toLowerCase().trim()]);
        await connection.end();
        return this;
    }

    async delete() {
        const connection = await db();
        await connection.query("DELETE FROM Fileshare.UserRepos WHERE owner = ? AND repos = ?", [this.owner, this.repos]);
        await connection.end();
    }


    /**
     * @param owner {id}
     * @param repos {id}
     * @return {Promise<UserRepos|null>}
     */
    static async exists(owner, repos) {
        const connection = await db();
        const result =  Object.values(await connection.query('SELECT * FROM Fileshare.UserRepos WHERE owner = ? AND repos = ?', [owner, repos]));
        await connection.end();
        return result.length !== 0 ? result[0] : null;
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<UserRepos[]>}
     */
    static async from_user(id) {
        const connection = await db();
        const directories = [];
        for (const dir of Object.values(await connection.query('SELECT * FROM Fileshare.UserRepos WHERE owner = ?', [id])))
            directories.push(new UserRepos(dir));
        await connection.end()
        return directories;
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<UserRepos[]>}
     */
    static async from_repos(id) {
        const connection = await db();
        const directories = [];
        for (const dir of Object.values(await connection.query('SELECT * FROM Fileshare.UserRepos WHERE repos = ?', [id])))
            directories.push(new UserRepos(dir));
        await connection.end();
        return directories;
    }
}

module.exports = {UserRepos}