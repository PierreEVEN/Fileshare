import {context_menu_item} from "../../../context_menu/contexts/context_item";
import {is_touch_screen} from "../../../../../utilities/utils";

require('./item.scss')

class ItemView {
    /**
     * @param item {FilesystemItem}
     * @param container {HTMLElement}
     * @param events {object}
     */
    constructor(item, container, events = {}) {
        this.item = item;
        this.container = container;

        this.events = events;

        if (item.is_regular_file)
            this.div = require('./file.hbs')({item: item.display_data()}, {
                clicked: (event) => {
                    this.events.select(event.ctrlKey, event.shiftKey);
                },
                dblclicked: (event) => {
                    if (!item.in_trash && !is_touch_screen())
                        this.events.open();
                },
                context_menu: (e) => {
                    e.preventDefault();
                    this.events.context_menu();
                }
            });
        else
            this.div = require('./directory.hbs')({item: item.display_data()}, {
                clicked: (event) => {
                    this.events.select(event.ctrlKey, event.shiftKey);
                },
                dblclicked: (event) => {
                    if (!item.in_trash && !is_touch_screen())
                        this.events.open();
                },
                context_menu: (e) => {
                    e.preventDefault();
                    this.events.context_menu();
                }
            });
        this.div.id = item.id;
        container.append(this.div);
    }

    remove() {
        this.div.remove();
    }
}

export {ItemView}