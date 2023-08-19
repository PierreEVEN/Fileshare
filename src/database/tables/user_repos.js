const db = require('./../../../database')
const Users = require('./user')
const Repos = require('./repos')

class UserRepos {
    constructor(user, repos) {
        this._user = user;
        this._repos = repos;
    }

    /**
     * @return {User}
     */
    get_user() {
        return this._user;
    }

    /**
     * @return {Repos}
     */
    get_repos() {
        return this._repos;
    }
}

async function init_table() {

    const connection = await db();

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'UserRepos'")).length === 0) {
        await connection.query("CREATE TABLE Personal.UserRepos (owner int, repos int, FOREIGN KEY(owner) REFERENCES Personal.Users(id),  PRIMARY KEY(OWNER, repos), FOREIGN KEY(repos) REFERENCES Personal.Repos(id));")
    }

    await connection.end();
}

const table_created = init_table();

/**
 * @return {Promise<[UserRepos]>}
 */
async function find_user(user) {
    return await table_created.then(async () => {
        const connection = await db();
        const user_repos = []
        for (const entry of Object.values(await connection.query("SELECT * FROM Personal.UserRepos WHERE owner = ?", [await user.get_id()]))) {
            user_repos.push(new UserRepos(await Users.find(entry.owner), await Repos.find(entry.repos)))
        }
        await connection.end();
        return user_repos;
    })
}

/**
 * @return {Promise<[UserRepos]>}
 */
async function find_repos(repos) {
    return await table_created.then(async () => {
        const connection = await db();
        const user_repos = []
        for (const entry of Object.values(await connection.query("SELECT * FROM Personal.UserRepos WHERE repos = ?", [await repos.get_id()]))) {
            user_repos.push(new UserRepos(await Users.find(entry.owner), await Repos.find(entry.repos)))
        }
        await connection.end();
        return user_repos;
    })
}

/**
 * @return {Promise<UserRepos>}
 */
async function insert(user, repos) {
    return await table_created.then(async () => {
        const connection = await db();
        await connection.query('INSERT INTO personal.UserRepos (owner, repos) VALUES (?, ?)', [await user.get_id(), await repos.get_id()]);
        await connection.end();
        return new UserRepos(user, repos);
    })
}

module.exports = {find_user, find_repos, insert};