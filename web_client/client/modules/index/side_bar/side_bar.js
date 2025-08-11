import {Repository} from "../../../types/repository";
import {User} from "../../../types/user";
import {context_menu_my_repositories} from "../context_menu/contexts/context_my_repositories";
import {EventManager} from "../../../types/event_manager";
import {APP_COOKIES} from "../tools/cookies/cookies";
import {AppWidget} from "../../../app_widget";
import "./category"
import {ContentRequest} from "../../../types/remote_filesystem/content_request";

require('./side_bar.scss')

class SideBar extends AppWidget {
    constructor() {
        super();
        /**
         * @type {User}
         * @private
         */
        this._connected_user = undefined;

        this.set_content(require('./side_bar.hbs'), {}, {
            context_my_repositories: (e) => {
                if (e.target && e.target.parentElement === this.elements().my_repositories) {
                    context_menu_my_repositories(this.get_app());
                    e.preventDefault();
                }
            }
        });

        this._add_repository = this.get_app().pool.events.add('add_repository', async (repository) => {
            if (this.get_app().state.connected_user() && repository.owner === this.get_app().state.connected_user().id) {
                this.elements().my_repositories.add_repository(repository);
            }
        });

        this.show_menu_mobile = false;
        this.events = new EventManager();
    }

    connectedCallback() {
        if (!this._on_select_cb)
            this._on_select_cb = this.get_app().state.events.add('select', async selection => {
                await this._state_selection_changed(selection);
            })

        this._cb_user_connected = this.get_app().state.events.add('user_connected', async (data) => {
            this._refresh(data.new);
        });

        this._refresh(this.get_app().state.connected_user());
    }

    disconnectedCallback() {
        if (this._cb_user_connected)
            this._cb_user_connected.remove();
        delete this._cb_user_connected;
        if (this._on_select_cb)
            this._on_select_cb.remove();
        delete this._on_select_cb;
        if (this._add_repository)
            this._add_repository.remove();
        delete this._add_repository;
    }

    /**
     * @param selection {StateSelection}
     * @private
     */
    async _state_selection_changed(selection) {
        if (!selection)
            return;
        let repository = selection.repository ? selection.repository.id : selection.item ? selection.item.repository : null;

        if (!repository) {
            if (this._last_selected)
                this._last_selected.clear_tree_selection();
            this.elements().my_repositories.set_expanded(false);
            this.elements().shared.set_expanded(false);
            this.elements().recent.set_expanded(false);

            return;
        }

        let tree_root = null;
        {
            if (this._load_available_repositories_promise)
                await this._load_available_repositories_promise;
            if (this.elements().my_repositories.get_repository(repository))
                tree_root = this.elements().my_repositories;
            if (!tree_root)
                if (this.elements().shared.get_repository(repository))
                    tree_root = this.elements().shared;
        }
        if (!tree_root) {
            if (this._load_recent_promise)
                await this._load_recent_promise;
             if (this.elements().recent.get_repository(repository))
                 tree_root = this.elements().recent;
        }
        if (!tree_root)
            return;

        tree_root.set_expanded(true);
        const repository_div = tree_root.get_repository(repository);

        if (this._last_selected) {
            if (this._last_selected !== repository_div)
                this._last_selected.clear_tree_selection();
        }
        this._last_selected = repository_div;

        if (selection.item && !selection.item.in_trash) {
            repository_div.focus_item(selection.item);
        } else {
            repository_div.focus_root(selection.in_trash, true);
        }
    }

    show_mobile() {
        this.show_menu_mobile = !this.show_menu_mobile;
        if (this.show_menu_mobile)
            this.parentElement.classList.add('show');
        else
            this.parentElement.classList.remove('show');
        this.events.broadcast('show_mobile', this.show_menu_mobile);
    }

    /**
     * @param connected_user {User}
     * @private
     */
    async _refresh(connected_user) {
        if (this._connected_user !== connected_user) {
            this._connected_user = connected_user;

            if (connected_user) {
                this.elements().my_repositories.style.display = 'flex';
                this.elements().shared.style.display = 'flex';
            } else {
                this.elements().my_repositories.style.display = 'none';
                this.elements().shared.style.display = 'none';
            }
        }
        const selection = this.get_app().state.selection();
        if (!(selection.user || selection.repository || selection.item)) {
            if (connected_user)
                this.elements().my_repositories.set_expanded(true);
            else
                this.elements().recent.set_expanded(true);
        }

        if (connected_user) {
            if (this._load_available_repositories_promise)
                await this._load_available_repositories_promise;

            this._load_available_repositories_promise = new Promise(async (resolve) => {
                const available_repositories = await this.get_app().pool.available_repositories();

                const my_repos_sorted = available_repositories.owned.sort(((a, b) => {
                    return a.display_name.plain().localeCompare(b.display_name.plain())
                }));
                for (const repository of my_repos_sorted)
                    this.elements().my_repositories.add_repository(repository);

                const shared_sorted = available_repositories.shared.sort(((a, b) => {
                    return a.display_name.plain().localeCompare(b.display_name.plain())
                }));
                for (const repository of shared_sorted)
                    this.elements().shared.add_repository(repository);
                resolve();
            });
        }

        if (this._load_recent_promise)
            await this._load_recent_promise;
        this._load_recent_promise = new Promise(async (resolve) => {
            const last_repositories = APP_COOKIES.get_last_repositories();
            await this.get_app().pool.fetch_content(new ContentRequest().repository(last_repositories));

            const repositories = [];
            for (const repository of last_repositories) {
                const repository_object = this.get_app().pool.find_repository(repository);
                if (repository_object)
                    repositories.push(repository_object);
            }
            const last_sorted = repositories.sort(((a, b) => {
                return a.display_name.plain().localeCompare(b.display_name.plain())
            }));
            for (const repository of last_sorted)
                this.elements().recent.add_repository(repository);
            resolve();
        });
    }
}

customElements.define("side-bar", SideBar);