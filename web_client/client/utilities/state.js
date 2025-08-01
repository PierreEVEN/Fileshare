import {User} from "../types/user";
import {Repository} from "../types/repository";
import {APP_COOKIES} from "../modules/index/tools/cookies/cookies";
import {EventManager} from "../types/event_manager";
import {StateSelection} from "./state_selection";

class AppState {
    /**
     * @param app {FileshareApp}
     */
    constructor(app) {
        /**
         * @type {FileshareApp}
         */
        this.app = app;

        /**
         * @type {EventManager}
         */
        this.events = new EventManager();

        this._connected_user = null;

        /**
         * @type {StateSelection}
         * @private
         */
        this._selected_item = new StateSelection();

        addEventListener('popstate', async (event) => {
            if (event.state && event.state.app_action)
                await this.select(await new StateSelection()._from_raw_data(this.app, event.state.selection), false);
        })
    }

    /********************************************************************
     *                          CONNECTION                              *
     *******************************************************************/

    async set_connected_user(new_user) {
        if ((new_user ? new_user.id : null) === (this._connected_user ? this._connected_user.id : null))
            return;

        const old = this._connected_user;
        this._connected_user = new_user;
        await this.events.broadcast('user_connected', {old: old, new: new_user});
    }

    connected_user() {
        return this._connected_user;
    }

    /********************************************************************
     *                          CONNECTION                              *
     *******************************************************************/



    /********************************************************************
     *                          SELECTION                               *
     *******************************************************************/

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
                const user = selection.user || (repository ? await User.fetch(this.app, repository.owner) : null);
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

    async _clear_selection() {
        await this.events.broadcast('deselect', this._selected_item);
        this._selected_item = new StateSelection();
    }
}

export {AppState}