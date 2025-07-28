import {Repository} from "../../../types/repository";
import {User} from "../../../types/user";
import {context_menu_my_repositories} from "../context_menu/contexts/context_my_repositories";
import {EventManager, GLOBAL_EVENTS} from "../../../types/event_manager";
import {APP_COOKIES} from "../tools/cookies/cookies";
import {AppWidget} from "../../../app_widget";

require('./side_bar.scss')

class SideBar extends AppWidget {
    constructor() {
        super();
        /**
         * @type {User}
         * @private
         */
        this._connected_user = undefined;
        this._first_time = true;

        const div = require('./side_bar.hbs')({}, {
            expand_my_repositories: async () => {
                await this.expand_my_repositories(!this._my_repos_expanded);
            },
            switch_shared: async () => {
                await this.expand_shared(!this._shared_expanded);
            },
            switch_recent: async () => {
                await this.expand_recent(!this._recent_expanded);
            },
            context_my_repositories: (e) => {
                context_menu_my_repositories(this.get_app());
                e.preventDefault();
            }
        });
        this._elements = div['hb_elements'];
        for (const element of div)
            this.append(element);

        GLOBAL_EVENTS.add('on_connected_user_changed', async (data) => {
            this.refresh(data.new);
        });
        this.refresh(this.get_app().app_config.connected_user());

        /**
         * @type {Map<number, TreeButton>}
         * @private
         */
        this._my_repositories_loaded = new Map();

        /**
         * @type {Map<number, TreeButton>}
         * @private
         */
        this._shared_repositories_loaded = new Map();

        /**
         * @type {Map<number, TreeButton>}
         * @private
         */
        this._recent_repositories_loaded = new Map();

        this._add_repository = GLOBAL_EVENTS.add('add_repository', async (repository) => {
            if (this._my_repos_expanded && !this._my_repositories_loaded.has(repository.id) && this.get_app().app_config.connected_user() && repository.owner === this.get_app().app_config.connected_user().id) {
                const div = document.createElement('repository-tree-button').set_repository(repository).set_expandable(true);
                this._elements.my_repositories.append(div);
                this._my_repositories_loaded.set(repository.id, div);
            }
        });

        this._remove_repository = GLOBAL_EVENTS.add('remove_repository', async (repository) => {
            const my_repos_loaded = this._my_repositories_loaded.get(repository.id);
            if (my_repos_loaded) {
                my_repos_loaded.root.remove();
                this._my_repositories_loaded.delete(repository.id);
            }
        });

        this.show_menu_mobile = false;
        this.selected_div = null;

        this.events = new EventManager();
    }

    connectedCallback() {
        if (!this._on_select_cb)
            this._on_select_cb = this.get_app().state.events.add('select', async selection => {
                await this._state_selection_changed(selection);
            })

        this._state_selection_changed(this.get_app().state.selection())
    }

    disconnectedCallback() {
        if (this._on_select_cb)
            this._on_select_cb.remove();
        delete this._on_select_cb;
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

        let tree_root = this._my_repositories_loaded.get(repository);
        if (!tree_root)
            tree_root = this._shared_repositories_loaded.get(repository)
        if (!tree_root)
            tree_root = this._recent_repositories_loaded.get(repository)
        if (!tree_root)
            return;

        if (this._last_selected) {
            if (this._last_selected !== tree_root)
                this._last_selected.clear_selection();
        }
        this._last_selected = tree_root;

        if (selection.item) {
            tree_root.focus_item(selection.item);
        } else {
            tree_root.focus_root(selection.in_trash, true);
        }
    }

    async expand_my_repositories(expanded) {
        if (this._my_repos_expanded === expanded)
            return;
        this._elements.my_repositories.innerHTML = '';
        this._my_repositories_loaded = new Map()
        if (expanded) {
            this._elements.div_my_repositories.classList.add('expand');
            const my_repos_sorted = (await Repository.my_repositories(this.get_app())).sort(((a, b) => {
                return a.display_name.plain().localeCompare(b.display_name.plain())
            }));
            for (const repository of my_repos_sorted) {
                if (!this._my_repositories_loaded.has(repository.id)) {
                    const div = document.createElement('repository-tree-button').set_repository(repository).set_expandable(true);
                    this._elements.my_repositories.append(div);
                    this._my_repositories_loaded.set(repository.id, div);
                }
            }
        } else {
            this._elements.div_my_repositories.classList.remove('expand');
        }
        this._my_repos_expanded = expanded;
    }

    async expand_shared(expanded) {
        if (this._shared_expanded === expanded)
            return;
        this._elements.shared.innerHTML = '';
        this._shared_expanded = expanded;
        if (expanded) {
            this._elements.div_shared.classList.add('expand');
            const repositories_sorted = (await Repository.shared_repositories(this.get_app())).sort(((a, b) => {
                return a.display_name.plain().localeCompare(b.display_name.plain())
            }));

            for (const repository of repositories_sorted) {
                const div = document.createElement('repository-tree-button').set_repository(repository).set_expandable(true);
                this._elements.shared.append(div);
                this._shared_repositories_loaded.set(repository.id, div);
            }
        } else {
            this._elements.div_shared.classList.remove('expand');
        }
    }

    async expand_recent(expanded) {
        if (this._recent_expanded === expanded)
            return;
        this._elements.recent.innerHTML = '';
        this._recent_expanded = expanded;
        this._recent_repositories_loaded.clear();

        if (expanded) {
            this._elements.div_recent.classList.add('expand');

            const repositories_sorted = (await Repository.find(this.get_app(), APP_COOKIES.get_last_repositories())).sort(((a, b) => {
                return a.display_name.plain().localeCompare(b.display_name.plain())
            }));

            for (const repository of repositories_sorted) {
                if (repository && !this._recent_repositories_loaded.has(repository.id)) {
                    const div = document.createElement('repository-tree-button').set_repository(repository).set_expandable(true);
                    this._elements.recent.append(div);
                    this._recent_repositories_loaded.set(repository.id, div);
                }
            }
        } else {
            this._elements.div_recent.classList.remove('expand');
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
     */
    refresh(connected_user) {
        if (this._connected_user !== connected_user) {
            this._connected_user = connected_user;

            if (connected_user) {
                this._elements.div_my_repositories.style.display = 'flex';
                this._elements.div_shared.style.display = 'flex';
            } else {
                this._elements.div_my_repositories.style.display = 'none';
                this._elements.div_shared.style.display = 'none';
            }
        }
    }

    remove() {
        if (this._add_repository)
            this._add_repository.remove();
        if (this._remove_repository)
            this._remove_repository.remove();
        delete this._remove_repository;
        delete this._add_repository;
    }
}

customElements.define("side-bar", SideBar);