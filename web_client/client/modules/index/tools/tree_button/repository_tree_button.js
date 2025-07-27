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
            else if (this.is_in_trash())
                await this.get_app().state.select(new StateSelection().set_repository(await this._repository, true));
            else
                await this.get_app().state.select(new StateSelection().set_repository(await this._repository));
        }
    }

    async is_a_child(item) {
        if (!this._repository)
            return false;
        if (this.is_in_trash()) {
            if (item.in_trash && item.repository === this._repository.id)
                if (!item.parent_item || !(await item.filesystem().fetch_item(item.parent_item)).in_trash)
                    return true;
            return false;
        }
        else
            return item.repository === this._repository.id && !item.parent_item && !item.in_trash;

    }

    get_content() {
        if (this.is_in_trash()) {
            return new TrashContentProvider(this._repository);
            //return this._repository ? await this._repository.content.trash_content() : new Set();
        } else {
            return new RepositoryRootProvider(this._repository);
            //return this._repository ? await this._repository.content.root_content() : new Set();
        }
    }

    get_filesystem() {
        return this._repository ? this._repository.content : null;
    }
}

customElements.define('repository-tree-button', RepositoryTreeButton);

export {RepositoryTreeButton}