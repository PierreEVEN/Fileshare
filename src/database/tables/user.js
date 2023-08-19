const db = require('./../../../database')

const Storage = require('../storage')

const user_storage = new Storage();

class User {
    constructor(id) {
        this._id = id;
    }

    /**
     * @return {number}
     */
    get_id() {
        return this._id;
    }

    /**
     * @return {Promise<User>}
     */
    async get_username() {
        if (!this._username)
            await this._update_data_internal()
        return this._username
    }

    /**
     * @return {Promise<string>}
     */
    async get_email() {
        if (!this._email)
            await this._update_data_internal()
        return this._email
    }

    async _update_data_internal() {
        const connection = await db();
        const result = await db.query('SELECT * FROM personal.account WHERE id = ?', [this._id])
        await connection.end();

        if (Object.values(result).length > 0) {
            const data = result[0];
            this._email = data.email;
            this._username = data.username;
        }
        else {
            throw new Error(`Failed to get user id '${this._id}'`);
        }
    }
}

/**
 * @return {User}
 */
function create(id) {
    let user = user_storage.find(id);
    if (!user) {
        user = new User(id);
        user_storage.add(id);
    }
    return user;
}

/**
 * @return {Promise<User>}
 */
async function insert() {
    const connection = await db();
    await connection.query('INSERT INTO personal.accounts () VALUES ()', []);
    await connection.end();
}

module.exports = {create, insert};