import {EncString} from "./encstring";
import {fetch_api} from "../utilities/request";
import {Message, NOTIFICATION} from "../modules/index/tools/message_box/notification";
import {EventManager} from "./event_manager";
import {APP_CONFIG} from "./app_config";

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
     * @param data
     * @return {User}
     */
    static new(data) {
        const existing = this.find(data.id);
        if (existing) {
            return existing;
        }
        return new User(data);
    }


    remove() {
        this._build_from_data({id: 0});
        this.events.broadcast('refresh', this);
        if (APP_CONFIG.connected_user() === this)
            APP_CONFIG.set_connected_user(null);
    }

    async refresh() {
        let data = await fetch_api("user/find/", "POST", [this.id])
            .catch(error => NOTIFICATION.fatal(new Message(error).title(`Impossible de trouver l'utilisateur ${this.id}`)));
        if (data.length !== 0) {
            this._build_from_data(data[0]);
        }
        this.events.broadcast('refresh', this);
    }

    /**
     * @param id {number}
     * @returns {User}
     */
    static find(id) {
        return User._LOCAL_CACHE.get(id);
    }

    /**
     * @param name {EncString}
     * @param exact {boolean}
     * @returns {Promise<User[]>}
     */
    static async search_from_name(name, exact) {
        let users = await fetch_api("user/search/", "POST", {name: name, exact: exact})
            .catch(error => NOTIFICATION.fatal(new Message(error).title(`Recherche échouée`)));
        const found_users = [];
        for (const user_id of users) {
            found_users.push(await User.fetch(user_id));
        }
        return found_users;
    }

    /**
     * @param id {number}
     * @returns {Promise<User>}
     */
    static async fetch(id) {
        const current = User._LOCAL_CACHE.get(id);
        if (current)
            return current;
        let user = await fetch_api("user/find/", "POST", [id])
            .catch(error => NOTIFICATION.fatal(new Message(error).title(`Impossible de trouver l'utilisateur ${id}`)));
        if (user.length !== 0)
            return User.new(user[0]);
        return null;
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