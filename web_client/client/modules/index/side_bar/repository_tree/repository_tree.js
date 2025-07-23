import {GLOBAL_EVENTS} from "../../../../types/event_manager";
import {context_menu_item} from "../../context_menu/contexts/context_item";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";

class RepositoryTree {

    /**
     * @param side_bar {SideBar}
     * @param container {HTMLElement}
     * @param repository {Repository}
     */
    constructor(side_bar, container, repository) {
        this.repository = repository;

        const root_div = require('./repository_tree_root.hbs')(repository.display_data(), {
            trash: async () => {
                await this.side_bar.get_app().set_display_trash(this.repository);
                this.side_bar.select_div(root_div.hb_elements.trash);
            }
        });
        root_div.hb_elements.button.onclick = () => {
            root_div.hb_elements.trash.style.display = root_div.hb_elements.button.expanded() ? "flex" : "none";
        }
        this._elements = root_div.hb_elements;
        this.root = root_div;
        this.side_bar = side_bar;
        container.append(root_div);
        this._elements.button.set_repository(repository);
    }

    async expand_to_item(item, trash) {
        return this._elements.button.focus_item(item);
    }
}

export {RepositoryTree}