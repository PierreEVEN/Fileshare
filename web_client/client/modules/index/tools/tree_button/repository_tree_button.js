import {Repository} from "../../../../types/repository";
import {TreeButton} from "./tree_button";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";
import {RepositoryRootProvider} from "../../../../types/viewport_content/providers";
import {StateSelection} from "../../../../utilities/state_selection";

class RepositoryTreeButton extends TreeButton {
    connectedCallback() {
        if (this.hasAttribute('repository')) {
            this.get_app().pool.fetch_repository(Number(this.getAttribute('repository'))).then(result => {
                this._repository = result;
                super.connectedCallback();
            })
        } else {
            super.connectedCallback();
        }
    }

    /**
     * @param repository {Repository}
     * @returns {RepositoryTreeButton}
     */
    set_repository(repository) {
        /**
         * @type {Repository}
         * @private
         */
        if (this._repository && repository && this._repository.id === repository.id && this.isConnected)
            return this;
        this._repository = repository;
        this._build_or_rebuild();
        return this;
    }

    this_item() {
        return this._repository;
    }

    get_name() {
        return this._repository ? this._repository.display_name.plain() : "";
    }

    get_icon() {
        return '/public/images/icons/icons8-storage-96.png';
    }

    context_menu() {
        if (this._repository)
            context_menu_repository(this.get_app(), this._repository);
    }

    async open(new_tab) {
        if (this._repository) {
            if (new_tab)
                window.open(await this._repository.url(this.get_app()));
            await this.get_app().state.select(new StateSelection().set_repository(await this._repository));
        }
    }

    get_content() {
        return this._repository ? new RepositoryRootProvider(this._repository) : null;
    }

    /**
     * @param in_trash {boolean}
     * @param expand {boolean}
     */
    async focus_root(in_trash, expand = false) {
        if (in_trash && this._div_trash) {
            await this.set_expanded(true);
            this._div_trash._set_selected(true);
            if (expand)
                await this._div_trash.set_expanded(true)
        } else {
            await super.focus_root(in_trash, true);
        }
    }

    _compare_sort(a, b) {
        if (a.constructor.name === 'TrashTreeButton')
            return -1;
        if (b.constructor.name === 'TrashTreeButton')
            return 1;
        return super._compare_sort(a, b);
    }

    async set_expanded(expand) {
        await super.set_expanded(expand);

        if (!this._div_trash && this.expanded() && this.get_app().state.connected_user()) {
            /**
             * @type {TrashTreeButton}
             * @private
             */
            this._div_trash = document.createElement('trash-tree-button')
                .set_repository(this._repository)
                .set_expandable(true);
            this._div_trash.style.display = 'none';
            this._div_trash._root = this.get_tree_root();
            this._insert_child(this._div_trash);
        }
    }
}

customElements.define('repository-tree-button', RepositoryTreeButton);