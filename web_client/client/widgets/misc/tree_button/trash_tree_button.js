import {Repository} from "../../../src/remote_filesystem/repository";
import {TreeButton} from "./tree_button";
import {TrashContentProvider} from "../../../src/viewport_content/providers";
import {StateSelection} from "../../../src/state/state_selection";

class TrashTreeButton extends TreeButton {

    constructor() {
        super();
        this._show_regular_files = true;
    }

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
     * @returns {TrashTreeButton}
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
        return 'Corbeille';
    }

    get_icon() {
        return '/public/images/icons/icons8-full-trash-96.png';
    }

    context_menu() { }

    async open(new_tab) {
        if (this._repository) {
            if (new_tab)
                window.open(await this._repository.trash_url(this.get_app()));
            await this.get_app().state.select(new StateSelection().set_repository(await this._repository, true));
        }
    }

    get_content() {
        return this._repository ? new TrashContentProvider(this._repository) : null;
    }

    _add_item(item) {
        super._add_item(item);
        if (this._items.size !== 0)
            this.style.display = 'flex';
    }

    _remove_item(item) {
        super._remove_item(item);
        if (this._items.size === 0)
            this.style.display = 'none';
    }
}

customElements.define('trash-tree-button', TrashTreeButton);
