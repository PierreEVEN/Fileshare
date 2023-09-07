const db = require('../../database')
const Users = require('./user')
const Repos = require('./repos')

class UserRepos {
    constructor(user, repos, access_type) {
        this._user = user;
        this._repos = repos;
        this._access_type = access_type;
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

    get_access() {
        return this._access_type;
    }
}

async function init_table() {

    const connection = await db();

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Fileshare' AND TABLE_NAME = 'UserRepos'")).length === 0) {
        await connection.query(`CREATE TABLE Fileshare.UserRepos (
            owner int,
            repos int,
            access_type ENUM('read-only', 'contributor', 'moderator') NOT NULL,
            PRIMARY KEY(OWNER, repos),
            FOREIGN KEY(owner) REFERENCES Fileshare.Users(id),
            FOREIGN KEY(repos) REFERENCES Fileshare.Repos(id)
        );`)
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
        for (const entry of Object.values(await connection.query("SELECT * FROM Fileshare.UserRepos WHERE owner = ?", [await user.get_id()]))) {
            user_repos.push(new UserRepos(await Users.find(entry.owner), await Repos.find(entry.repos), entry.access_type))
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
        for (const entry of Object.values(await connection.query("SELECT * FROM Fileshare.UserRepos WHERE repos = ?", [await repos.get_id()]))) {
            user_repos.push(new UserRepos(await Users.find(entry.owner), await Repos.find(entry.repos)))
        }
        await connection.end();
        return user_repos;
    })
}

/**
 * @return {Promise<UserRepos>}
 */
async function insert(user, repos, access_type) {
    return await table_created.then(async () => {
        const connection = await db();
        await connection.query('INSERT INTO Fileshare.UserRepos (owner, repos, access_type) VALUES (?, ?, ?)', [await user.get_id(), await repos.get_id(), access_type]);
        await connection.end();
        return new UserRepos(user, repos);
    })
}

module.exports = {find_user, find_repos, insert};