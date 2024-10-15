import {APP} from "../../../../../app";
import {context_menu_item} from "../../../context_menu/contexts/context_item";
import {context_menu_repository} from "../../../context_menu/contexts/context_repository";

require("./toolbar.scss");

class ViewportToolbar {
    /**
     * @param container {HTMLElement}
     * @param repository {Repository}
     */
    constructor(container, repository) {
        let div = require('./toolbar.hbs')({}, {
            select_root: async () => {
                if (this.is_trash)
                    await APP.set_display_trash(repository);
                else
                    await APP.set_display_repository(repository);
            },
            download: () => {
                if (this.current_item)
                    this.current_item.download();
                else
                    this.repository.download();
            },
            context: () => {
                if (this.current_item)
                    context_menu_item(this.current_item);
                else
                    context_menu_repository(this.repository);
            }
        });
        this.current_item = null;
        this.repository = repository;
        this.elements = div.elements;
        container.append(div);
    }

    /**
     * @param current_item {FilesystemItem}
     * @param is_trash {boolean}
     */
    async set_path_to(current_item, is_trash) {
        this.current_item = current_item;
        this.is_trash = is_trash && !current_item;
        this.elements.root.innerText = this.repository.display_name.plain();
        this.elements.repos_icon.src = is_trash ? '/public/images/icons/icons8-full-trash-96.png' : '/public/images/icons/icons8-storage-96.png'

        this.elements.path.innerHTML = '';
        if (current_item) {
            let first = true;
            let item = current_item;
            while (item) {
                if (!item.is_regular_file) {
                    const current_item = item;
                    const div = require('./toolbar_path_btn.hbs')(item.display_data(), {
                        select: async () => {
                            await APP.set_display_item(current_item);
                        }
                    });
                    if (first) {
                        first = false;
                        div.style['margin-right'] = 'auto';
                    }
                    this.elements.path.append(div);
                }
                item = item.parent_item ? await item.filesystem().fetch_item(item.parent_item) : null;
            }
        }
    }
}

export {ViewportToolbar}