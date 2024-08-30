const db = require('./tools/database')
const assert = require("assert");
const {as_id, as_enum, as_boolean} = require("./tools/db_utils");

class UserRepos {
    /**
     * @param data {Object}
     */
    constructor(data) {
        /**
         * @type {number}
         */
        this.owner = Number(data.owner);
        /**
         * @type {number}
         */
        this.repos = Number(data.repos);
        /**
         * @type {number}
         */
        this.root_item = data.root_item < 0 || !data.root_item ? null : Number(data.root_item);
        /**
         * @type {string}
         */
        this.access_type = as_enum(data.access_type);
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
        await db.single().query(`INSERT INTO fileshare.userrepos
            (owner, repos, root_item, access_type) VALUES
            ($1, $2, $3, $4)
            ON CONFLICT (owner, repos, root_item) DO  
            UPDATE SET owner = $1, repos = $2, root_item = $3, access_type = $4;`,
            [as_id(this.owner), as_id(this.repos), this.root_item ? as_id(this.root_item) : as_id(-1), as_enum(this.access_type)]);

        return this;
    }

    async delete() {
        await db.single().query("DELETE FROM fileshare.userrepos WHERE owner = $1 AND repos = $2 AND root_item = $3", [as_id(this.owner), as_id(this.repos), this.root_item ? as_id(this.root_item) : -1]);
    }


    /**
     * @param owner {number}
     * @param repos {number}
     * @return {Promise<UserRepos|null>}
     */
    static async exists(owner, repos) {
        return await db.single().fetch_object(UserRepos, 'SELECT * FROM fileshare.userrepos WHERE owner = $1 AND repos = $2', [as_id(owner), as_id(repos)]);
    }

    /**
     * @return {Promise<UserRepos>}
     * @param user {number}
     * @param repos {number}
     * @param root {number|null}
     */
    static async from_keys(user, repos, root) {
        return await db.single().fetch_object(UserRepos, 'SELECT * FROM fileshare.userrepos WHERE owner = $1 AND repos = $2 AND root_item = $3', [as_id(user), as_id(repos), root ? as_id(root) : -1]);
    }

    /**
     * @param id {number} repos_id
     * @return {Promise<UserRepos[]>}
     */
    static async from_user(id) {
        return await db.single().fetch_objects(UserRepos, 'SELECT * FROM fileshare.userrepos WHERE owner = $1', [as_id(id)]);
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