import {User} from "../types/user";
import {Repository} from "../types/repository";
import {FilesystemItem} from "../types/filesystem_stream";
import {APP_COOKIES} from "../modules/index/tools/cookies/cookies";
import {EventManager} from "../types/event_manager";

class StateSelection {
    constructor() {
        /**
         * @type {Repository}
         */
        this.repository = null;
        /**
         * @type {FilesystemItem}
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
     * @param item {FilesystemItem}
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
                this.repository = await Repository.find(app, value);
            else if (key === "user")
                this.user = await User.fetch(app, value);
            else if (key === "item") {
                const repository = await Repository.find(app, value.repository);
                this.item = await repository.content.find(value.id);
            } else {
                this[key] = value;
            }
        }
        return this;
    }
}


class AppState {
    /**
     * @param app {FileshareApp}
     */
    constructor(app) {
        this.app = app;
        addEventListener('popstate', async (event) => {
            if (event.state && event.state.app_action)
                await this.select(await new StateSelection()._from_raw_data(this.app, event.state.selection), false);
        })

        this._disable_state = false;

        this.events = new EventManager();

        /**
         * @type {StateSelection}
         * @private
         */
        this._selected_item = new StateSelection();
    }

    async _clear_selection() {
        await this.events.broadcast('deselect', this._selected_item);
        this._selected_item = new StateSelection();
    }

    selection() {
        return this._selected_item;
    }

    /**
     * @param selection {StateSelection}
     * @param with_state {boolean}
     */
    async select(selection, with_state = true) {
        await this._clear_selection();
        if (selection) {
            this._selected_item = selection;
            await this.events.broadcast('select', this._selected_item);

            if (selection.item)
                APP_COOKIES.push_last_repositories(selection.item.repository);
            if (selection.repository)
                APP_COOKIES.push_last_repositories(selection.repository.id)

            if (with_state) {
                const repository = selection.repository ? selection.repository : selection.item ? await Repository.find(this.app, selection.item.repository) : null;
                const user = selection.user || repository ? await User.fetch(this.app, repository.owner) : null;

                if (selection.item) {
                    if (selection.in_trash)
                        history.pushState({
                            app_action: true,
                            selection: selection._get_raw_data(),
                        }, "", `${this.app.app_config.origin()}/${user.name.encoded()}/${repository.url_name.encoded()}/trash`);
                    else
                        history.pushState({
                            app_action: true,
                            selection: selection._get_raw_data(),
                        }, "", `${this.app.app_config.origin()}/${user.name.encoded()}/${repository.url_name.encoded()}/tree${selection.item.absolute_path.encoded()}`);
                } else if (selection.repository) {
                    if (selection.in_settings)
                        history.pushState({
                            app_action: true,
                            selection: selection._get_raw_data(),
                        }, "", `${this.app.app_config.origin()}/${user.name.encoded()}/${repository.url_name.encoded()}/settings`);
                    else if (selection.in_trash)
                        history.pushState({
                            app_action: true,
                            selection: selection._get_raw_data(),
                        }, "", `${this.app.app_config.origin()}/${user.name.encoded()}/${repository.url_name.encoded()}/trash`);
                    else
                        history.pushState({
                            app_action: true,
                            selection: selection._get_raw_data(),
                        }, "", `${this.app.app_config.origin()}/${user.name.encoded()}/${repository.url_name.encoded()}`);
                } else if (selection.user) {
                    history.pushState({
                        app_action: true,
                        selection: selection._get_raw_data(),
                    }, "", `${this.app.app_config.origin()}/${user.name.encoded()}`);
                } else if (selection.in_admin_pannel) {
                    history.pushState({
                        app_action: true,
                        selection: selection._get_raw_data(),
                    }, "", `${this.app.app_config.origin()}/administration`);
                } else {
                    history.pushState({
                        app_action: true,
                        selection: selection._get_raw_data(),
                    }, "", `${this.app.app_config.origin()}`);
                }
            }
        }
    }
}

export {AppState, StateSelection}