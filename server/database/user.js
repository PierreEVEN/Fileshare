const db = require('./tools/database')
const {gen_uid, gen_uhash} = require("./tools/uid_generator");
const {Repos} = require("./repos")
const bcrypt = require("bcrypt");
const assert = require("assert");
const {as_id, as_boolean, as_enum, as_hash_key, as_number, as_token} = require("./tools/db_utils");
const {ServerString} = require("../server_string");
const dayjs = require("dayjs");

const id_base = new Set();

class User {
    /**
     * @param data {Object}
     */
    constructor(data) {
        /**
         * @type {number}
         */
        this.id = Number(data.id);
        /**
         * @type {ServerString}
         */
        this.email = ServerString.FromDB(data.email);
        /**
         * @type {ServerString}
         */
        this.name = ServerString.FromDB(data.name);
        /**
         * @type {boolean}
         */
        this.allow_contact = data.allow_contact || true;
        /**
         * @type {string}
         */
        this.role = String(data.role || 'guest');
    }

    /**
     * Is this user allowed to create a repository
     * @return {boolean}
     */
    can_create_repos() {
        return this.role === 'admin' || this.role === 'vip';
    }

    /**
     * Is this user is a super user
     * @return {boolean}
     */
    is_admin() {
        return this.role === 'admin';
    }

    /**
     * Update user data
     * @return {Promise<User>}
     */
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
            [as_id(this.id), this.email.encoded(), this.name.encoded(), as_boolean(this.allow_contact), as_enum(this.role)]);
        return this;
    }

    /**
     * Create a new auth token
     * @param device {ServerString}
     * @return {Promise<(string|number)[]>}
     */
    async gen_auth_token(device) {
        const connection = await db.persist();
        const token = await gen_uhash(async (id) => await connection.found('SELECT * FROM fileshare.authtoken WHERE token = $1', [as_data_string(id)]), id_base);
        await connection.end();

        // Valid for 30 days
        const exp_date = dayjs().unix() + 86400 * 30;
        console.log(dayjs.unix(exp_date))
        await db.single().query(`INSERT INTO fileshare.authtoken
            (owner, token, expdate, device) VALUES
            ($1, $2, $3, $4);`,
            [as_id(this.id), token.toString(), as_number(exp_date), device.encoded().substring(0, 255)]);
        return [token, exp_date];
    }


    /**
     * @param token {string}
     * @return {Promise<void>}
     */
    async delete_auth_token(token) {
        await db.single().query("DELETE FROM fileshare.authtoken WHERE owner = $1 AND token = $2", [as_id(this.id), as_token(token)]);
    }

    /**
     * Delete a user and all of it's uploaded data
     * @return {Promise<void>}
     */
    async delete() {

        for (const repos of await Repos.from_owner(this.id))
            await repos.delete();

        await db.single().query("DELETE FROM fileshare.users WHERE id = $1", [as_id(this.id)]);
    }

    /**
     * Create a new user
     * @return {Promise<User>}
     */
    static async create(data) {
        let password = bcrypt.hashSync(data.password, 10);

        const user = new User({
            name: ServerString.FromDB(data.name).encoded(),
            email: ServerString.FromDB(data.email).encoded()
        });
        assert(password);
        assert(user.email);
        assert(user.name);
        assert(user.allow_contact);
        assert(user.role);
        await db.single().query(`INSERT INTO fileshare.users
            (id, email, password_hash, name, allow_contact, role) VALUES
            ($1, $2, $3, $4, $5, $6)`,
            [as_id(user.id || await User.gen_id()), user.email.encoded(), as_hash_key(password), user.name.encoded(), as_boolean(user.allow_contact), as_enum(user.role)]);
        return await User.from_credentials(data.email, data.password);
    }

    /**
     * @param password {string}
     * @return {Promise<void>}
     */
    async set_password(password) {
        let hashed_password = bcrypt.hashSync(password, 10);
        await db.single().query("UPDATE fileshare.users SET password_hash = $1 WHERE id = $2", [as_hash_key(hashed_password), as_id(this.id)]);
        await db.single().query("DELETE FROM fileshare.authtoken WHERE owner = $1", [as_id(this.id)]);
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

        const token_data = await db.single().fetch_row("SELECT * FROM fileshare.authtoken WHERE token = $1", [as_token(token)]);
        if (!token_data)
            return null;
        const user = await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE id  = $1', [token_data.owner]);
        if (token_data.expdate < dayjs().unix()) {
            console.error('Connection token expired');
            user.delete_auth_token(token_data.token);
            return null;
        } else
            return user;
    }

    /**
     * @param id {number} Directory id
     * @return {Promise<User|null>}
     */
    static async from_id(id) {
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE id = $1', [as_id(id)]);
    }

    /**
     * @param name {string} Directory id
     * @return {Promise<User|null>}
     */
    static async from_name(name) {
        if (name.length === 0)
            return null;
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE LOWER(name) = LOWER($1)', [name.toString()]);
    }

    /**
     * @param email {string} Directory id
     * @return {Promise<User|null>}
     */
    static async from_email(email) {
        if (email.length === 0)
            return null;
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE LOWER(email) = LOWER($1)', [email.toString()]);
    }

    /**
     * Use credentials to retrieve a given user
     * @param login {ServerString}
     * @param password {string} raw password
     * @return {Promise<User | null>}
     */
    static async from_credentials(login, password) {
        let found_user = null;

        for (let user of (await db.single().query('SELECT * FROM fileshare.users WHERE name = $1 OR email = $2', [new ServerString(login).encoded(), new ServerString(login).encoded()])).rows) {
            if (bcrypt.compareSync(password, user['password_hash'].toString())) {
                found_user = user;
                break;
            }
        }
        return found_user ? new User(found_user) : null;
    }

    /**
     * Test if a user with the given login or email already exists
     * @param login {ServerString}
     * @param email {ServerString}
     * @return {Promise<boolean>}
     */
    static async exists(login, email) {
        return await db.single().fetch_object(User, 'SELECT * FROM fileshare.users WHERE name = $1 OR email = $2', [new ServerString(login).encoded(), new ServerString(email).encoded()]);
    }
}

module.exports = {User};

