import {AppWidget} from "../../../app_widget";

class SideBarCategory extends AppWidget {
    constructor() {
        super();

        this._loaded_repositories = new Map();
        this._expand = false;

        this._remove_repository = this.get_app().pool.events.add('remove_repository', async (repository) => {
            const loaded = this._loaded_repositories.get(repository.id);
            if (loaded)
                loaded.remove();
            this._loaded_repositories.delete(repository.id);
        })

        if (this.hasAttribute('src'))
            this.src = this.getAttribute('src');

        if (this.hasAttribute('value'))
            this.value = this.getAttribute('value');
    }

    connectedCallback() {
        this.innerHTML = '';
        const content = require('./category.hbs')(this, {
            open: () => {
                this.set_expanded(!this._expand);
            }
        });
        this._elements = content.hb_elements;
        for (const element of content)
            this.append(element);
    }

    disconnectedCallback() {
        if (this._remove_repository)
            this._remove_repository.remove();
        delete this._remove_repository;
    }

    set_expanded(expand) {
        this._expand = expand;
        if (this._expand)
            this.classList.add('expand');
        else
            this.classList.remove('expand');
    }

    /**
     * @param id {number}
     * @returns {RepositoryTreeButton}
     */
    get_repository(id) {
        return this._loaded_repositories.get(id);
    }

    /**
     * @param repository {Repository}
     */
    add_repository(repository) {
        if (this._loaded_repositories.has(repository.id))
            return;
        const div = document.createElement('repository-tree-button').set_repository(repository).set_expandable(true);
        this._append_repository(div);
        this._loaded_repositories.set(repository.id, div);
    }

    _append_repository(div) {
        let existing_children = Array.from(this._elements.content.children);
        let insertIndex = existing_children.findIndex(child => child.get_name().localeCompare(div.get_name()) > 0);
        if (insertIndex === -1) {
            this.elements().content.appendChild(div);
        } else {
            this.elements().content.insertBefore(div, this._elements.content.children[insertIndex]);
        }
    }
}

customElements.define('side-bar-category', SideBarCategory);