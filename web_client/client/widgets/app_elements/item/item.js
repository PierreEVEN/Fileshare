require('./item.scss')
const {AppWidget} = require("../../../src/app_widget");
const {context_menu_item} = require("../../misc/context_menu/contexts/context_item");
const {is_touch_screen} = require("../../../src/utilities/utils");
const {StateSelection} = require("../../../src/state/state_selection");
const {EventManager} = require("../../../src/event_manager");

class ItemView extends AppWidget {
    constructor() {
        super();
    }

    /**
     * @param item {RemoteItem}
     * @returns {ItemView}
     */
    set_item(item) {
        this._item = item;
        if (!this.isConnected)
            return this;

        this.set_content(require('./item.hbs'), {item: item.display_data()}, {
            context_menu: async (event) => {
                event.preventDefault();
                if (this.context_menu)
                    this.context_menu();
            },
            click: async (event) => {
                if (this.select)
                    this.select(event.ctrlKey, event.shiftKey);
            },
            dblclick: async () => {
                await this.get_app().state.select(new StateSelection().set_item(item));
            },
        });
        return this;
    }

    /**
     * @returns {RemoteItem}
     */
    item() {
        return this._item;
    }

    connectedCallback() {
        this.set_item(this._item);
    }
}

customElements.define("item-view", ItemView);