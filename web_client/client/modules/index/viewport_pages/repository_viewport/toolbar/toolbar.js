import {context_menu_item} from "../../../context_menu/contexts/context_item";
import {context_menu_repository} from "../../../context_menu/contexts/context_repository";
import {AppWidget} from "../../../../../app_widget";
import {StateSelection} from "../../../../../utilities/state_selection";

require("./toolbar.scss");

class ViewportToolbar extends AppWidget {
    constructor() {
        super();
        this.current_item = null;
    }

    connectedCallback() {
        this._rebuild_div();
    }

    _rebuild_div() {
        if (!this.isConnected)
            return;
        this.innerHTML = '';
        let div = require('./toolbar.hbs')({is_trash: this.is_trash}, {
            select_root: async () => {
                if (this.is_trash)
                    await this.get_app().state.select(new StateSelection().set_repository(this.repository, true));
                else
                    await this.get_app().state.select(new StateSelection().set_repository(this.repository));
            },
            download: () => {
                if (this.current_item)
                    this.current_item.download();
                else
                    this.repository.download();
            },
            context: () => {
                if (this.current_item)
                    context_menu_item(this.get_app(), this.current_item);
                else
                    context_menu_repository(this.get_app(), this.repository);
            }
        });
        this.hb_elements = div.hb_elements;
        for (const element of div)
            this.append(element);
    }

    disconnectedCallback() {
        this.innerHTML = '';
    }

    set_repository(repository) {
        this.repository = repository;
    }

    /**
     * @param current_item {RemoteItem}
     * @param is_trash {boolean}
     */
    async set_toolbar_path(current_item, is_trash) {
        this.current_item = current_item;
        if (is_trash !== this.is_trash) {
            this.is_trash = is_trash;
            this._rebuild_div();
        }

        this.hb_elements.repository.set_repository(this.repository);

        this.hb_elements.path.innerHTML = '';
        if (current_item) {
            let first = true;
            let item = current_item;
            while (item) {
                if (!item.is_regular_file) {
                    const div = document.createElement('item-tree-button').set_directory(item);
                    if (first) {
                        first = false;
                        div.style['margin-right'] = 'auto';
                    }
                    this.hb_elements.path.append(div);
                }
                item = item.parent_item ? await item.pool().fetch_item(item.parent_item) : null;
            }
        }
    }
}


customElements.define("viewport-toolbar", ViewportToolbar);