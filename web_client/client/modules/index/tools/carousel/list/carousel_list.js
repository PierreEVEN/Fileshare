
require('./carousel_list.scss')
const {EventManager} = require("../../../../../types/event_manager");

class CarouselList extends HTMLElement{
    /**
     * @param viewport {RepositoryViewport}
     * @param on_select_item
     */
    constructor(viewport, on_select_item) {
        super();
        this.viewport = viewport;

        this.on_select_item = on_select_item;

        this._last_selected = null;

        this._element_map = new Map();

        this.events = new EventManager();
    }

    connectedCallback() {
        this._rebuild();
    }

    select_item(meta_data, scroll_center = false) {
        if (this.events)
            this.events.broadcast('select', meta_data)

        if (this._last_selected) {
            this._last_selected.classList.remove('selected');
        }
        this._last_selected = this._element_map.get(meta_data.id);

        if (!this._last_selected)
            return;
        this._last_selected.classList.add('selected');

        if (this.on_select_item)
            this.on_select_item(meta_data);
        this._last_selected.scrollIntoView({behavior: "smooth", inline: scroll_center ? 'center' : 'nearest'});
        this._update_left_right_buttons();
    }

    async _select_next() {
        if (!this._last_selected.nextSibling.item_id)
            return;
        const meta_data = await this._items.get(this._last_selected.nextSibling.item_id);
        if (meta_data && meta_data.is_regular_file) {
            this.select_item(meta_data, true);
        }
    }

    async _select_previous() {
        if (!this._last_selected.previousSibling.item_id)
            return;
        const meta_data = await this._items.get(this._last_selected.previousSibling.item_id);
        if (meta_data && meta_data.is_regular_file) {
            this.select_item(meta_data, true);
        }
    }

    /**
     * @param items {FilesystemItem[]}
     * @returns {Promise<void>}
     */
    async set_items(items) {
        /**
         * @type {Map<number, FilesystemItem>}
         * @private
         */
        this._items = new Map();
        if (items) {
            for (const [_, item] of items) {
                this._items.set(item.id, item);
            }
        }

        await this._rebuild();
    }

    async _rebuild() {
        if (!this.isConnected)
            return;
        this.innerHTML = '';
        if (!this._items)
            return;

        const content = require('./carousel_list.hbs')({}, {
            move_left: () => {
                this._select_previous();
            },
            move_right: () => {
                this._select_next();
            }
        });

        this.addEventListener('wheel', e => {
            if (e.ctrlKey) {
                e.stopPropagation();
                e.preventDefault();
            }
        })
        this._elements = content.hb_elements;

        this._elements.list.addEventListener('wheel', e => {
            content.scrollLeft += (e.deltaY * 0.5);
        })

        this._elements.list.innerHTML = '';

        const left_spacer = document.createElement('div');
        left_spacer.style.width = '100px';
        this._elements.list.append(left_spacer);

        for (const [_, object] of this._items) {
            if (object.is_regular_file) {
                const callbacks = {};
                const item = require('./carousel_list_item.hbs')({item: object.display_data()}, callbacks);
                this._element_map.set(object.id, item);
                callbacks.on_click = () => {
                    this.select_item(object)
                }
                item.item_id = object.id;
                this._elements.list.append(item);
            }
        }

        const right_spacer = document.createElement('div');
        right_spacer.style.width = '100px';
        this._elements.list.append(right_spacer);
        for (const element of content)
            this.append(element);
        this._update_left_right_buttons();
    }

    _update_left_right_buttons() {
        if (!this._last_selected || !this._last_selected.previousSibling.classList.contains('carousel-item'))
            this._elements.move_left.style.display = 'none';
        else
            this._elements.move_left.style.display = 'unset';
        if (!this._last_selected || !this._last_selected.nextSibling.classList.contains('carousel-item'))
            this._elements.move_right.style.display = 'none';
        else
            this._elements.move_right.style.display = 'unset';
    }
}


customElements.define("carousel-list", CarouselList);