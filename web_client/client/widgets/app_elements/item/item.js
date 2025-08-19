require('./item.scss')
const {AppWidget} = require("../../../src/app_widget");
const {StateSelection} = require("../../../src/state/state_selection");
class ItemView extends AppWidget {
    constructor() {
        super();

        this.oncontextmenu = async (event) => {
            event.preventDefault();
            if (this.context_menu)
                this.context_menu();
        };

        this.ondblclick = async () => {
            await this.get_app().state.select(new StateSelection().set_item(this._item));
        };

        this.onclick = async (event) => {
            if (this.select)
                this.select(event.ctrlKey, event.shiftKey);
        };
    }

    /**
     * @param item {RemoteItem}
     * @returns {ItemView}
     */
    set_item(item) {
        this._item = item;
        if (!this.isConnected)
            return this;

        this.set_content(require('./item.hbs'), {item: item.display_data()}, {});
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