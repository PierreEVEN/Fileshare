const db = require('../database')
const assert = require("assert");
const {File} = require("./files");
const {as_id, as_enum} = require("../db_utils");

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
        await db.single().query(`REPLACE INTO fileshare.userrepos
            (owner, repos, access_type) VALUES
            ($1, $2, $3);`,
            [as_id(this.owner), as_id(this.repos), as_enum(this.access_type)]);
        return this;
    }

    async delete() {
        await db.single().query("DELETE FROM fileshare.userrepos WHERE owner = $1 AND repos = $2", [as_id(this.owner), as_id(this.repos)]);
    }


    /**
     * @param owner {id}
     * @param repos {id}
     * @return {Promise<UserRepos|null>}
     */
    static async exists(owner, repos) {
        await db.single().fetch_object(UserRepos, 'SELECT * FROM fileshare.userRepos WHERE owner = $1 AND repos = $2', [as_id(owner), as_id(repos)]);
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<UserRepos[]>}
     */
    static async from_user(id) {
        return await db.single().fetch_objects(UserRepos, 'SELECT * FROM fileshare.userRepos WHERE owner = $1', [as_id(id)]);
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<UserRepos[]>}
     */
    static async from_repos(id) {

        return await db.single().fetch_objects(UserRepos, 'SELECT * FROM fileshare.userrepos WHERE repos = $1', [as_id(id)]);
    }
}

module.exports = {UserRepos}