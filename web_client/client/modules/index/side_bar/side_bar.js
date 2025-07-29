import {Repository} from "../../../types/repository";
import {User} from "../../../types/user";
import {context_menu_my_repositories} from "../context_menu/contexts/context_my_repositories";
import {EventManager, GLOBAL_EVENTS} from "../../../types/event_manager";
import {APP_COOKIES} from "../tools/cookies/cookies";
import {AppWidget} from "../../../app_widget";
import "./category"

require('./side_bar.scss')

class SideBar extends AppWidget {
    constructor() {
        super();
        /**
         * @type {User}
         * @private
         */
        this._connected_user = undefined;

        const div = require('./side_bar.hbs')({}, {
            context_my_repositories: (e) => {
                if (e.target && e.target.parentElement === this._elements.my_repositories) {
                    context_menu_my_repositories(this.get_app());
                    e.preventDefault();
                }
            }
        });
        this._elements = div['hb_elements'];
        for (const element of div)
            this.append(element);

        GLOBAL_EVENTS.add('on_connected_user_changed', async (data) => {
            this._refresh(data.new);
        });

        this._add_repository = GLOBAL_EVENTS.add('add_repository', async (repository) => {
            if (this._my_repos_expanded && !this._my_repositories_loaded.has(repository.id) && this.get_app().app_config.connected_user() && repository.owner === this.get_app().app_config.connected_user().id) {
                this._elements.my_repositories.add_repository(repository);
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

        this._refresh(this.get_app().app_config.connected_user());
    }

    disconnectedCallback() {
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

        if (!repository)
            return;

        let tree_root = null;
        {
            if (this._load_my_repos_promise)
                await this._load_my_repos_promise;
            if (this._elements.my_repositories.get_repository(repository))
                tree_root = this._elements.my_repositories;
        }
        if (!tree_root) {
            if (this._load_shared_promise)
                await this._load_shared_promise;
            if (this._elements.shared.get_repository(repository))
                tree_root = this._elements.shared;
        }
        if (!tree_root) {
            if (this._load_recent_promise)
                await this._load_recent_promise;
             if (this._elements.recent.get_repository(repository))
                 tree_root = this._elements.recent;
        }
        if (!tree_root)
            return;

        tree_root.set_expanded(true);
        const repository_div = tree_root.get_repository(repository);

        if (this._last_selected) {
            if (this._last_selected !== repository_div)
                this._last_selected.clear_selection();
        }
        this._last_selected = repository_div;

        if (selection.item) {
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
                this._elements.my_repositories.style.display = 'flex';
                this._elements.shared.style.display = 'flex';
            } else {
                this._elements.my_repositories.style.display = 'none';
                this._elements.shared.style.display = 'none';
            }
        }
        const selection = this.get_app().state.selection();
        if (!(selection.user || selection.repository || selection.item)) {
            if (connected_user)
                this._elements.my_repositories.set_expanded(true);
            else
                this._elements.recent.set_expanded(true);
        }

        if (connected_user) {
            if (this._load_my_repos_promise)
                await this._load_my_repos_promise;
            this._load_my_repos_promise = new Promise(async (resolve) => {
                const my_repos_sorted = (await Repository.my_repositories(this.get_app())).sort(((a, b) => {
                    return a.display_name.plain().localeCompare(b.display_name.plain())
                }));
                for (const repository of my_repos_sorted)
                    this._elements.my_repositories.add_repository(repository);
                resolve();
            });

            if (this._load_shared_promise)
                await this._load_shared_promise;
            this._load_shared_promise = new Promise(async (resolve) => {
                const shared_sorted = (await Repository.shared_repositories(this.get_app())).sort(((a, b) => {
                    return a.display_name.plain().localeCompare(b.display_name.plain())
                }));
                for (const repository of shared_sorted)
                    this._elements.shared.add_repository(repository);
                resolve();
            });
        }

        if (this._load_recent_promise)
            await this._load_recent_promise;
        this._load_recent_promise = new Promise(async (resolve) => {
            const last_sorted = (await Repository.find(this.get_app(), APP_COOKIES.get_last_repositories())).sort(((a, b) => {
                return a.display_name.plain().localeCompare(b.display_name.plain())
            }));
            for (const repository of last_sorted)
                this._elements.recent.add_repository(repository);
            resolve();
        });
    }
}

customElements.define("side-bar", SideBar);