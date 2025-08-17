import {User} from "../remote_filesystem/user";
import {Repository} from "../remote_filesystem/repository";
import {StateSelection} from "../state/state_selection";

class InitData {
    /**
     * @param pool {ContentPool}
     * @param data {Object}
     */
    constructor(pool, data) {
        console.assert(data, "Invalid application configuration data")
        this._connected_user = data.connected_user ? pool._register_user(data.connected_user) : null;
        this._display_user = data.display_user ? pool._register_user(data.display_user) : null;
        this._display_repository = data.display_repository ? pool._register_repository(data.display_repository) : null;
        this._display_item = data.display_item ? pool._register_item(data.display_item) : null;

        /**
         * @type {String}
         */
        this.origin = data.origin;

        /**
         * @type {boolean}
         */
        this.in_trash = data.in_trash;

        /**
         * @type {boolean}
         */
        this.show_stats = data.show_stats;

        /**
         * @type {boolean}
         */
        this.repository_settings = data.repository_settings;

        /**
         * @type {{code: String, message: String}|null}
         */
        this.error = (data.error_code || data.error_message) ? {code: data.error_code, message: data.error_message} : null;
    }

    /**
     * @return {Promise<User>}
     */
    async connected_user() {
        return this._connected_user;
    }

    /**
     * @return {Promise<User>}
     */
    async display_user() {
        return this._display_user;
    }

    /**
     * @return {Promise<Repository>}
     */
    async display_repository() {
        return this._display_repository;
    }

    /**
     * @return {Promise<RemoteItem>}
     */
    async display_item() {
        return this._display_item;
    }

    /**
     * @param state {AppState}
     */
    async apply_to_state(state) {

        if (await this.connected_user())
            await state.set_connected_user(await this.connected_user())

        if (this.show_stats) {
            await state.select(new StateSelection().set_admin())
        } else if (await this.display_item()) {
            await state.select(new StateSelection().set_item(await this.display_item()))
        } else if (await this.display_repository()) {
            if (this.in_trash)
                await state.select(new StateSelection().set_repository(await this.display_repository(), true));
            else if (this.repository_settings) {
                await state.select(new StateSelection().set_repository(await this.display_repository(), false, true));
            }
            else
                await state.select(new StateSelection().set_repository(await this.display_repository()));
        }
        else if (await this.display_user()) {
            await state.select(new StateSelection().set_user(await this.display_user()));
        }
    }
}

export {InitData}