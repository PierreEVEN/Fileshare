const db = require('../database')
const {gen_uhash, gen_uid} = require("../uid_generator");
const {Repos} = require("./repos")
const bcrypt = require("bcrypt");
const assert = require("assert");

const id_base = new Set();

class User {
    /**
     * @param data {Object}
     */
    constructor(data) {
        this.id = data.id;
        this.email = data.email ? decodeURIComponent(data.email) : null;
        this.name = data.name ? decodeURIComponent(data.name) : null;
        this.allow_contact = data.allow_contact || true;
        this.role = data.role || 'guest';
    }

    can_create_repos() {
        return this.role === 'admin' || this.role === 'vip';
    }

    async push() {
        this.id = this.id || await User.gen_id();
        assert(this.email);
        assert(this.name);
        assert(this.allow_contact);
        assert(this.role);
        const connection = await db();
        await connection.query(`REPLACE INTO Fileshare.Users
            (id, email, name, allow_contact, role) VALUES
            (?, ?, ?, ?, ?, ?);`,
            [this.id, encodeURIComponent(this.email), encodeURIComponent(this.name), this.allow_contact.toLowerCase().trim(), this.role]);
        await connection.end();
        return this;
    }

    async delete() {

        for (const repos of await Repos.from_owner(this.id))
            await repos.delete();

        const connection = await db();
        await connection.query("DELETE FROM Fileshare.Users WHERE id = ?", [this.id]);
        await connection.end();
    }

    static async create(data) {
        const user = new User(data);
        assert(data.password);
        assert(user.email);
        assert(user.name);
        assert(user.allow_contact);
        assert(user.role);
        const connection = await db();
        await connection.query(`REPLACE INTO Fileshare.Users
            (id, email, password_hash, name, allow_contact, role) VALUES
            (?, ?, ?, ?, ?, ?);`,
            [user.id || await User.gen_id(), encodeURIComponent(user.email), await bcrypt.hash(data.password, 10), encodeURIComponent(user.name), user.allow_contact, user.role.toLowerCase().trim()]);
        await connection.end();
        return await User.from_credentials(data.email, data.password);
    }
    static async gen_id() {
        const connection = await db();
        const id = await gen_uid(async (id) => Object(await connection.query('SELECT * FROM Fileshare.Users WHERE id = ?', [id])).length, id_base);
        await connection.end();
        return id;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<User|null>}
     */
    static async from_id(id) {
        const connection = await db();
        const found_data = Object.values(await connection.query('SELECT * FROM Fileshare.Users WHERE id = ?', [id]));
        const user = found_data.length === 1 ? new User(found_data[0]) : null;
        await connection.end();
        return user;
    }
    /**
     * @return {Promise<User | null>}
     */
    static async from_credentials(login, password) {
        const connection = await db()
        const res = Object.values(await connection.query('SELECT * FROM Fileshare.Users WHERE name = ? OR email = ?', [encodeURIComponent(login), encodeURIComponent(login)]));
        await connection.end();
        let found_user = null;
        for (let user of res) {
            if (bcrypt.compareSync(password, user.password_hash.toString())) {
                found_user = user;
                break;
            }
        }
        return found_user ? new User(found_user) : null;
    }

    /**
     * @return {Promise<boolean>}
     */
    static async exists(login, email) {
        const connection = await db()
        const res = await connection.query('SELECT * FROM Fileshare.Users WHERE name = ? OR email = ?', [encodeURIComponent(login), encodeURIComponent(email)]);
        await connection.end();
        return Object.values(res).length !== 0;
    }
}

module.exports = {User};

