import {Repository} from "../../../../types/repository";
import {TreeButton} from "./tree_button";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";

class RepositoryTreeButton extends TreeButton {
    connectedCallback() {
        if (this.hasAttribute('id')) {
            Repository.find(this.get_app(), Number(this.getAttribute('id'))).then(result => {
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
        this.generate_content();
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

    async open() {
        if (this._repository)
            await this.get_app().set_display_repository(this._repository);
    }

    is_a_child(item) {
        if (!this._repository)
            return false;
        return item.repository === this._repository.id && item.parent_item === null;
    }

    async get_content() {
        return this._repository ? await this._repository.content.root_content() : new Set();
    }

    get_filesystem() {
        return this._repository ? this._repository.content : null;
    }
}

customElements.define('repository-tree-button', RepositoryTreeButton);