
require('./carousel_list.scss')
const {EventManager} = require("../../../../src/event_manager");
const {AppWidget} = require("../../../../src/app_widget");

class CarouselList extends AppWidget {
    constructor() {
        super();
        this._last_selected = null;
        this._element_map = new Map();
        this.events = new EventManager();

        this.addEventListener('wheel', e => {
            if (e.ctrlKey) {
                e.stopPropagation();
                e.preventDefault();
            }
        })
    }

    connectedCallback() {
        this.set_content(require('./carousel_list.hbs'), {}, {
            move_left: async () => {
                await this._select_previous();
            },
            move_right: async () => {
                await this._select_next();
            }
        });

        this._cb_wheel_listener = e => {
            this.elements().list.parentElement.scrollLeft += (e.deltaY * 0.5);
        };
        this.elements().list.addEventListener('wheel', this._cb_wheel_listener);

        this._rebuild();
    }

    disconnectedCallback() {
        this.elements().list.removeEventListener('wheel', this._cb_wheel_listener);
    }

    /**
     * @param item {RemoteItem}
     * @param scroll_center {boolean}
     * @param no_update {boolean}
     * @returns {Promise<void>}
     */
    async select_item(item, scroll_center = false, no_update = false) {
        if (!no_update)
            await this.events.broadcast('select', item)

        if (this._last_selected) {
            if (this._last_selected.id === item.id)
                return;
            this._last_selected.classList.remove('selected');
        }
        this._last_selected = this._element_map.get(item.id);

        if (!this._last_selected)
            return;
        this._last_selected.classList.add('selected');

        this._last_selected.scrollIntoView({behavior: "smooth", inline: scroll_center ? 'center' : 'nearest'});
        this._update_left_right_buttons();
    }

    async _select_next() {
        if (!this._last_selected.nextSibling.item_id)
            return;
        const meta_data = await this._items.get(this._last_selected.nextSibling.item_id);
        if (meta_data && meta_data.is_regular_file) {
            this.select_item(meta_data, false);
        }
    }

    async _select_previous() {
        if (!this._last_selected.previousSibling.item_id)
            return;
        const meta_data = await this._items.get(this._last_selected.previousSibling.item_id);
        if (meta_data && meta_data.is_regular_file) {
            this.select_item(meta_data, false);
        }
    }

    /**
     * @param a {RemoteItem}
     * @param b {RemoteItem}
     * @return number
     * @private
     */
    _compare_sort(a, b) {
        return a.name.plain().localeCompare(b.name.plain());
    }

    /**
     * @param items {RemoteItem[]}
     * @returns {Promise<void>}
     */
    async set_items(items) {
        /**
         * @type {Map<number, RemoteItem>}
         * @private
         */
        this._items = new Map();
        if (items) {
            for (const item of items.sort(this._compare_sort)) {
                this._items.set(item.id, item);
            }
        }

        delete this._last_selected;

        await this._rebuild();
    }

    _rebuild() {
        if (!this.isConnected)
            return;
        if (!this._items)
            return;

        this.elements().list.innerHTML = '';
        const left_spacer = document.createElement('div');
        left_spacer.style.width = '100px';
        this.elements().list.append(left_spacer);

        for (const [_, object] of this._items) {
            if (object.is_regular_file) {
                const callbacks = {};
                const item = require('./carousel_list_item.hbs')({item: object.display_data()}, callbacks);
                this._element_map.set(object.id, item);
                callbacks.on_click = () => {
                    this.select_item(object)
                }
                item.item_id = object.id;
                this.elements().list.append(item);
            }
        }

        const right_spacer = document.createElement('div');
        right_spacer.style.width = '100px';
        this.elements().list.append(right_spacer);
        this._update_left_right_buttons();
    }

    _update_left_right_buttons() {
        if (!this._last_selected || !this._last_selected.previousSibling.classList.contains('carousel-item'))
            this.elements().move_left.style.display = 'none';
        else
            this.elements().move_left.style.display = 'unset';
        if (!this._last_selected || !this._last_selected.nextSibling.classList.contains('carousel-item'))
            this.elements().move_right.style.display = 'none';
        else
            this.elements().move_right.style.display = 'unset';
    }
}


customElements.define("carousel-list", CarouselList);