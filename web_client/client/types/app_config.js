import {User} from "./user";
import {FilesystemItem} from "./filesystem_stream";
import {Repository} from "./repository";
import {GLOBAL_EVENTS} from "./event_manager";

class AppConfig {
    constructor() {
        const data = JSON.parse(document.body.dataset['app_config']);
        console.assert(data, "Invalid application configuration data")

        /**
         * @type {User}
         */
        this._connected_user = data.connected_user ? User.new(data.connected_user) : null;
        /**
         * @type {User}
         */
        this._display_user = data.display_user ? User.new(data.display_user) : null;
        /**
         * @type {Repository}
         */
        this._display_repository = data['display_repository'] ? Repository.new(data['display_repository']) : null;
        /**
         * @type {Promise<FilesystemItem>}
         */
        this._display_item = null;
        this._pre_init_item = data['display_item'];

        console.assert(data.origin, "MISSING ORIGIN IN RECEIVED CONFIG");
        /**
         * @type {String}
         */
        this._origin = data.origin;
        /**
         * @type {boolean}
         */
        this._in_trash = data.in_trash;
        /**
         * @type {boolean}
         */
        this._repository_settings = data.repository_settings;
    }

    set_connected_user(new_user) {
        const old = this._connected_user;
        this._connected_user = new_user;
        GLOBAL_EVENTS.broadcast('on_connected_user_changed', {old: old, new: new_user});
    }

    set_display_repository(display_user, display_repository) {
        this._display_user = display_user;
        this._display_repository = display_user ? display_repository : null;
        document.dispatchEvent(new CustomEvent('on_display_user_changed', {'detail': display_user}));
        document.dispatchEvent(new CustomEvent('on_display_repository_changed', {'detail': this._display_repository}));
    }

    set_display_user(new_user) {
        this.set_display_repository(new_user, null);
    }

    connected_user() {
        return this._connected_user;
    }

    in_trash() {
        return this._in_trash;
    }

    repository_settings() {
        return this._repository_settings;
    }

    display_user() {
        return this._display_user;
    }

    async display_item() {
        if (!this._display_item && this._pre_init_item)
            this._display_item = FilesystemItem.new(this._pre_init_item);
        return await this._display_item;
    }

    display_repository() {
        return this._display_repository;
    }

    origin() {
        return this._origin;
    }
}

/**
 * @type {AppConfig}
 */
let APP_CONFIG = new AppConfig();

export {APP_CONFIG}