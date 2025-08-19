import {AppWidget} from "../../../src/app_widget";
import {EventManager} from "../../../src/event_manager";
import {Selector} from "./selector";
import {is_touch_screen} from "../../../src/utilities/utils";
import {StateSelection} from "../../../src/state/state_selection";
import {context_menu_item} from "../../misc/context_menu/contexts/context_item";

require('./content_page.scss')

class ContentPage extends AppWidget {
    constructor() {
        super();

        this.events = new EventManager();
        /**
         * @type {Map<number, ItemView>}
         * @private
         */
        this._items = new Map();

        this._page = 0;
        this._elements_per_page = 100;
    }

    /**
     * @param provider {ContentProvider}
     */
    async set_content_provider(provider) {
        if (!this.isConnected) {
            this._futur_provider = provider;
            return this;
        }

        if (provider && this._provider && this._provider.is_same(provider)) {
            provider.delete();
            return this;
        }

        if (this._provider)
            this._provider.delete();

        /**
         * @type {ContentProvider}
         * @private
         */
        this._provider = provider;

        this._clear();

        if (this._cb_provider_add)
            this._cb_provider_add.remove();
        if (!this._provider)
            return this;

        /**
         * @type {Selector}
         */
        this.selector = new Selector(this.children);

        const content = await this._provider.get_content();
        if (content.length > this._elements_per_page)
            console.warn("//@TODO : Handle multiple elements per page")
        for (let i = this._page * this._elements_per_page; i < content.length && i < (this._page + 1) * this._elements_per_page; ++i)
            this._add_item(content[i]);

        this._cb_provider_add = this._provider.events.add('add', item => {
            this._add_item(item);
        })

        return this;
    }

    connectedCallback() {
        this.set_content_provider(this._futur_provider);
    }

    /**
     * @param a {ItemView}
     * @param b {ItemView}
     * @return number
     * @private
     */
    _compare_sort(a, b) {
        const item_a = a.item();
        const item_b = b.item();
        if (item_a.is_regular_file && !item_b.is_regular_file)
            return -1;
        if (item_b.is_regular_file && !item_a.is_regular_file)
            return 1;
        return -item_a.name.plain().localeCompare(item_b.name.plain());
    }

    _add_item(item) {
        if (this._items.has(item.id))
            return;

        const div = document.createElement('item-view').set_item(item);

        div.context_menu = async () => {
            if (is_touch_screen()) {
                if (!this.mobile_selection || !this.selector.is_selected(item.id)) {
                    await this.selector.clear_selection();
                    this.mobile_selection = true;
                    await this.selector.action_select(item.id, false, false);
                } else {
                    const items = [];
                    for (const item_id of this.selector.get_selected_items()) {
                        items.push(await item.get_pool().fetch_item(item_id));
                    }
                    context_menu_item(this.get_app(), items);
                }
            } else {
                if (this.selector.is_selected(item.id)) {
                    const items = [];
                    for (const item_id of this.selector.get_selected_items()) {
                        items.push(await item.get_pool().fetch_item(item_id));
                    }
                    context_menu_item(this.get_app(), items);
                } else {
                    await this.selector.select_item(item.id, false, false);
                    context_menu_item(this.get_app(), item);
                }
            }
        }

        div.select = async (ctrl, shift) => {
            if (is_touch_screen()) {
                if (this.mobile_selection) {
                    await this.selector.action_select(item.id, true, false);
                } else {
                    await this.get_app().state.select(new StateSelection().set_item(item));
                }
            } else {
                await this.selector.action_select(item.id, ctrl, shift);
            }
        }

        this._items.set(item.id, div);
        let existing_children = Array.from(this.children);
        let insertIndex = existing_children.findIndex(child => this._compare_sort(child, div) < 0);
        if (insertIndex === -1)
            this.appendChild(div);
        else
            this.insertBefore(div, this.children[insertIndex]);
    }

    _clear() {
        this._items.clear();
        this.innerHTML = '';
    }

    disconnectedCallback() {
        if (this._cb_provider_add)
            this._cb_provider_add.remove();
        delete this._cb_provider_add;
        if (this._provider)
            this._provider.delete();
        delete this._provider;
    }
}


customElements.define('content-page', ContentPage);