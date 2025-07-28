import {Repository} from "../../../../types/repository";
import {TreeButton} from "./tree_button";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";
import {RepositoryRootProvider, TrashContentProvider} from "../../../../types/viewport_content/providers";
import {StateSelection} from "../../../../utilities/state";

class RepositoryTreeButton extends TreeButton {
    connectedCallback() {
        if (this.hasAttribute('repository')) {
            Repository.find(this.get_app(), Number(this.getAttribute('repository'))).then(result => {
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
        return this.is_in_trash() ? 'Corbeille' : this._repository ? this._repository.display_name.plain() : "";
    }

    get_icon() {
        return this.is_in_trash() ? '/public/images/icons/icons8-full-trash-96.png' : '/public/images/icons/icons8-storage-96.png';
    }

    context_menu() {
        if (!this.is_in_trash())
            if (this._repository)
                context_menu_repository(this.get_app(), this._repository);
    }

    async open(new_tab) {
        if (this._repository) {
            if (new_tab)
                window.open(this.is_in_trash() ? await this._repository.trash_url(this.get_app()) : await this._repository.url(this.get_app()));
            await this.get_app().state.select(new StateSelection().set_repository(await this._repository, this.is_in_trash()));
        }
    }

    get_content() {
        if (this.is_in_trash()) {
            return new TrashContentProvider(this._repository);
        } else {
            return new RepositoryRootProvider(this._repository);
        }
    }
}

customElements.define('repository-tree-button', RepositoryTreeButton);

export {RepositoryTreeButton}