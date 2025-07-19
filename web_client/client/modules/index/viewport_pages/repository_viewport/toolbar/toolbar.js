import {get_app} from "../../../../../app";
import {context_menu_item} from "../../../context_menu/contexts/context_item";
import {context_menu_repository} from "../../../context_menu/contexts/context_repository";

require("./toolbar.scss");

class ViewportToolbar extends HTMLElement {
    constructor() {
        super();
        this.current_item = null;
    }

    connectedCallback() {
        let div = require('./toolbar.hbs')({}, {
            select_root: async () => {
                if (this.is_trash)
                    await get_app(this).set_display_trash(this.repository);
                else
                    await get_app(this).set_display_repository(this.repository);
            },
            download: () => {
                if (this.current_item)
                    this.current_item.download();
                else
                    this.repository.download();
            },
            context: () => {
                if (this.current_item)
                    context_menu_item(this.current_item, div);
                else
                    context_menu_repository(this, this.repository);
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
     * @param current_item {FilesystemItem}
     * @param is_trash {boolean}
     */
    async set_toolbar_path(current_item, is_trash) {
        this.current_item = current_item;
        this.is_trash = is_trash && !current_item;
        this.hb_elements.root.innerText = this.repository.display_name.plain();
        this.hb_elements.repos_icon.src = is_trash ? '/public/images/icons/icons8-full-trash-96.png' : '/public/images/icons/icons8-storage-96.png'

        this.hb_elements.path.innerHTML = '';
        if (current_item) {
            let first = true;
            let item = current_item;
            while (item) {
                if (!item.is_regular_file) {
                    const current_item = item;
                    const div = require('./toolbar_path_btn.hbs')(item.display_data(), {
                        select: async () => {
                            await get_app(this).set_display_item(current_item);
                        }
                    });
                    if (first) {
                        first = false;
                        div.style['margin-right'] = 'auto';
                    }
                    this.hb_elements.path.append(div);
                }
                item = item.parent_item ? await item.filesystem().fetch_item(item.parent_item) : null;
            }
        }
    }
}


customElements.define("viewport-toolbar", ViewportToolbar);