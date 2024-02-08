const db = require('../database')
const {gen_uid, gen_uhash} = require("../uid_generator");
const {Repos} = require("./repos")
const bcrypt = require("bcrypt");
const assert = require("assert");
const {as_data_string, as_id, as_boolean, as_enum, as_hash_key, as_number} = require("../db_utils");

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
        await db.single().query(`INSERT INTO fileshare.users
            (id, email, name, allow_contact, role) VALUES
            ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO  
            UPDATE SET id = $1, email = $2, name = $3, allow_contact = $4, role = $5;`,
            [as_id(this.id), as_data_string(this.email), as_data_string(this.name), as_boolean(this.allow_contact), as_enum(this.role)]);
        return this;
    }

    async gen_auth_token() {
        const connection = await db.persist();
        const token = await gen_uhash(async (id) => await connection.found('SELECT * FROM fileshare.authtoken WHERE token = $1', [as_data_string(id)]), id_base);
        await connection.end();

        // Valid for 30 days
        const exp_date = new Date().getTime() + 86400000 * 30;

        await db.single().query(`INSERT INTO fileshare.authtoken
            (owner, token, expdate) VALUES
            ($1, $2, $3);`,
            [as_id(this.id), as_data_string(token), as_number(exp_date)]);
        return [token, exp_date];
    }

    async delete() {

        for (const repos of await Repos.from_owner(this.id))
            await repos.delete();

        await db.single().query("DELETE FROM fileshare.users WHERE id = $1", [as_id(this.id)]);
    }

    static async create(data) {
        const user = new User(data);
        assert(data.password);
        assert(user.email);
        assert(user.name);
        assert(user.allow_contact);
        assert(user.role);
        await db.single().query(`INSERT INTO fileshare.users
            (id, email, password_hash, name, allow_contact, role) VALUES
            ($1, $2, $3, $4, $5, $6)`,
            [as_id(user.id || await User.gen_id()), as_data_string(user.email), as_hash_key(await bcrypt.hash(data.password, 10)), as_data_string(user.name), as_boolean(user.allow_contact), as_enum(user.role)]);
        return await User.from_credentials(data.email, data.password);
    }
    static async gen_id() {
        const connection = await db.persist();
        const id = await gen_uid(async (id) => await connection.found('SELECT * FROM fileshare.users WHERE id = $1', [as_id(id)]), id_base);
        await connection.end();
        return id;
    }

    /**
     * @param token {string} Directory id
     * @return {Promise<User|null>}
     */
    static async from_auth_token(token) {
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE id IN (SELECT owner FROM fileshare.authtoken WHERE token = $1)', [as_data_string(token)]);
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<User|null>}
     */
    static async from_id(id) {
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE id = $1', [as_id(id)]);
    }
    /**
     * @return {Promise<User | null>}
     */
    static async from_credentials(login, password) {
        let found_user = null;
        for (let user of (await db.single().query('SELECT * FROM fileshare.users WHERE name = $1 OR email = $2', [as_data_string(login), as_data_string(login)])).rows) {
            if (bcrypt.compareSync(password, user['password_hash'].toString())) {
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
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE name = $1 OR email = $2', [as_data_string(login), as_data_string(email)]);
    }
}

module.exports = {User};

