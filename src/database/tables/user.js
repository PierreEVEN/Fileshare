const db = require('./../../../database')

const Storage = require('../storage')
const bcrypt = require("bcrypt");

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

    /**
     * @return {Promise<string>}
     */
    async get_role() {
        if (!this._role)
            await this._update_data_internal()
        return this._role
    }

    /**
     * @return {Promise<boolean>}
     */
    async does_allow_contact() {
        if (!this._allow_contact)
            await this._update_data_internal()
        return this._allow_contact
    }

    async public_data() {
        if (!this._username) {
            await this._update_data_internal()
        }
        return {
            id: this._id,
            username: this._username,
            email: this._email,
        }
    }

    async can_edit_repos() {
        return await this.get_role() === 'vip';
    }

    async _update_data_internal() {
        const connection = await db();
        const result = await connection.query('SELECT * FROM Personal.Users WHERE id = ?', [this._id])
        await connection.end();

        if (Object.values(result).length > 0) {
            const data = result[0];
            this._email = data.email;
            this._username = data.username;
            this._role = data.role;
            this._allow_contact = data.allow_contact
        } else {
            throw new Error(`Failed to get user id '${this._id}'`);
        }
        return this
    }
}

async function init_table() {

    const connection = await db();

    // Create Accounts table if needed
    if (Object.entries(await connection.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'Personal' AND TABLE_NAME = 'Users'")).length === 0) {
        await connection.query(`
            CREATE TABLE Personal.Users (
                id int AUTO_INCREMENT PRIMARY KEY,
                email varchar(200) UNIQUE,
                username varchar(200) UNIQUE,
                password_hash BINARY(64),
                allow_contact BOOLEAN DEFAULT false NOT NULL,
                role ENUM('visitor', 'guest', 'vip') DEFAULT 'visitor' NOT NULL,
            );`)
    }

    await connection.end();
}

const table_created = init_table();

/**
 * @return {Promise<User>}
 */
async function find(id) {
    return table_created.then(() => {
        let user = user_storage.find(id);
        if (!user) {
            user = new User(id);
            user_storage.add(id, user);
        }
        return user;
    })
}

/**
 * @return {Promise<User>}
 */
async function find_with_credentials(login, password) {

    const connection = await db()
    const res = await connection.query('SELECT * FROM Personal.Users WHERE username = ? OR email = ?', [login, login]);
    await connection.end();
    let found_user = null;
    for (let user of res) {
        if (bcrypt.compareSync(password, user.password_hash.toString())) {
            found_user = user;
            break;
        }
    }
    return found_user ? await find(found_user.id) : null;
}

/**
 * @return {Promise<User>}
 */
async function find_with_identifiers(login, email) {

    const connection = await db()
    const res = Object.values(await connection.query('SELECT * FROM Personal.Users WHERE username = ? OR email = ?', [login, email]));
    await connection.end();
    return res.length > 0 ? await find(res.id) : null;
}

/**
 * @return {Promise<User>}
 */
async function insert(email, username, password) {
    return await table_created.then(async () => {
        const connection = await db();
        const result = await connection.query('INSERT INTO Personal.Users (email, username, password_hash) VALUES (?, ?, ?)', [email, username, await bcrypt.hash(password, 10)]);
        await connection.end();
        return find(Number(result.insertId));
    })
}

module.exports = {find, insert, find_with_credentials, find_with_identifiers};