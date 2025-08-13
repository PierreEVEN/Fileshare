import {EncString} from "../encstring";
import {Message, NOTIFICATION} from "../../modules/index/tools/message_box/notification";
import {EventManager} from "../event_manager";

class UserRole {
    constructor(data) {
        switch (data) {
            case "Guest":
            case "Vip":
            case "Admin":
                /**
                 * @type{string}
                 * @private
                 */
                this._role = data;
                break;
            default:
                this._role = 'invalid'
                break;
        }
    }

    toString() {
        return this._role;
    }

    display_data() {
        switch (this._role) {
            case "Guest":
                return 'invité';
            case "Vip":
                return 'premium';
            case "Admin":
                return 'administrateur';
            default:
                return this._role;
        }
    }
}


class User {

    /**
     * @type {Map<number, User>}
     * @private
     */
    static _LOCAL_CACHE = new Map();

    constructor(data) {
        this.events = new EventManager();

        /**
         * @type {ContentPool}
         * @private
         */
        this._pool = null;

        this._build_from_data(data);
    }

    _build_from_data(data) {
        /**
         * @type {number}
         */
        this.id = data.id;
        /**
         * @type {EncString}
         */
        this.email = new EncString(data.email);
        /**
         * @type {EncString}
         */
        this.name = new EncString(data.name);
        /**
         * @type {EncString}
         */
        this.login = new EncString(data.login);
        /**
         * @type {UserRole}
         */
        this.user_role = new UserRole(data.user_role);
        /**
         * @type {boolean}
         */
        this.allow_contact = !!data.email;

        console.assert(!data['password_hash'])

        User._LOCAL_CACHE.set(this.id, this);
    }

    /**
     * @returns {ContentPool}
     */
    get_pool() {
        return this._pool;
    }

    /**
     * @param app {FileshareApp}
     */
    remove(app) {
        this._build_from_data({id: 0});
        this.events.broadcast('refresh', this);
        if (app.state.connected_user() === this)
            app.app_config.set_connected_user(null);
    }

    /**
     * @param app {FileshareApp}
     * @returns {Promise<void>}
     */
    async refresh(app) {
        let data = await app.fetch_api("user/find", "POST", [this.id])
            .catch(error => NOTIFICATION.fatal(new Message(error).title(`Impossible de trouver l'utilisateur ${this.id}`)));
        if (data.length !== 0) {
            this._build_from_data(data[0]);
        }
        this.events.broadcast('refresh', this);
    }

    /**
     * @param app {FileshareApp}
     * @param name {EncString}
     * @param exact {boolean}
     * @returns {Promise<User[]>}
     */
    static async search_from_name(app, name, exact) {
        let users = await app.fetch_api("user/search", "POST", {name: name, exact: exact})
            .catch(error => NOTIFICATION.fatal(new Message(error).title(`Recherche échouée`)));
        const found_users = [];
        for (const user_id of users) {
            found_users.push(await app.pool.fetch_user(user_id));
        }
        return found_users;
    }

    /**
     * @return {User}
     */
    display_data() {
        const result = JSON.parse(JSON.stringify(this));
        result.name = this.name.plain()
        result.login = this.login.plain();
        result.email = this.email ? this.email.plain() : null;
        result.user_role = this.user_role.display_data();
        return result
    }
}

export {User, UserRole}