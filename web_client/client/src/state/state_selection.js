import {Repository} from "../remote_filesystem/repository";
import {User} from "../remote_filesystem/user";

class StateSelection {
    constructor() {
        /**
         * @type {Repository}
         */
        this.repository = null;
        /**
         * @type {RemoteItem}
         */
        this.item = null;
        /**
         * @type {User}
         */
        this.user = null;
        /**
         * @type {boolean}
         */
        this.in_trash = false;
        /**
         * @type {boolean}
         */
        this.in_settings = false;

        /**
         * @type {boolean}
         */
        this.in_admin_pannel = false;
    }

    /**
     * @param repository {Repository}
     * @param in_trash {boolean}
     * @param in_settings {Boolean}
     * @return {StateSelection}
     */
    set_repository(repository, in_trash = false, in_settings = false) {
        this.repository = repository;
        this.in_trash = in_trash;
        this.in_settings = in_settings;
        return this;
    }

    /**
     * @param user {User}
     * @returns {StateSelection}
     */
    set_user(user) {
        this.user = user;
        return this;
    }

    /**
     * @returns {StateSelection}
     */
    set_admin() {
        this.in_admin_pannel = true;
        return this;
    }

    /**
     * @param item {RemoteItem}
     * @param in_trash {boolean}
     * @returns {StateSelection}
     */
    set_item(item, in_trash = false) {
        this.item = item;
        this.in_trash = in_trash;
        return this;
    }

    _get_raw_data() {
        const res = {};
        for (const [key, value] of Object.entries(this)) {
            if (!value)
                continue;
            if (key === "item")
                res[key] = {id: value.id, repository: value.repository};
            else if (key === "repository" || key === "user")
                res[key] = value.id;
            else
                res[key] = value;
        }
        return res;
    }

    async _from_raw_data(app, data) {
        for (const [key, value] of Object.entries(data)) {
            if (key === "repository")
                this.repository = await app.pool.fetch_repository(value);
            else if (key === "user")
                this.user = await app.pool.fetch_user(value);
            else if (key === "item") {
                this.item = await app.pool.fetch_item(value.id);
            } else {
                this[key] = value;
            }
        }
        return this;
    }
}

export {StateSelection}