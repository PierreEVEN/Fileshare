import {AppWidget} from "../../../../app_widget";
import {ContentRequest} from "../../../../types/remote_filesystem/content_request";

require('./tree_button.scss')

let UID = 0;

class TreeButton extends AppWidget {
    constructor() {
        super();

        this.UID = UID++;

        /**
         * @type {boolean}
         * @private
         */
        this._expandable = this.hasAttribute('expandable');

        /**
         * @type {boolean}
         * @private
         */
        this._show_regular_files = this.hasAttribute('show_regular_files');

        /**
         * @type {boolean}
         * @private
         */
        this._expanded = false;

        /**
         * @type {Map<number, TreeButton>}
         * @private
         */
        this._items = new Map();

        /**
         * @type {ContentProvider}
         * @private
         */
        this._content_provider = null;
    }

    connectedCallback() {
        this.className = 'tree-button';
        this._build_or_rebuild();
        this._init_content_provider();
    }

    disconnectedCallback() {
        if (this._on_add_item)
            this._on_add_item.remove();
        if (this._on_remove_item)
            this._on_remove_item.remove();
        if (this._content_provider)
            this._content_provider.delete();
        this._content_provider = null;
    }

    /****************************************
     *              SETTINGS                *
     * **************************************/

    set_expandable(expandable) {
        if (this._expandable === expandable)
            return this;

        this._expandable = expandable;
        this._build_or_rebuild();
        return this;
    }

    show_regular_files(enable) {
        if (this._show_regular_files === enable)
            return this;
        this._show_regular_files = enable;
        this._build_or_rebuild();
        return this;
    }

    /****************************************
     *              MECHANICS               *
     * **************************************/

    /**
     * @param in_trash {boolean}
     * @param expand {boolean}
     */
    async focus_root(in_trash, expand = false) {
        this._set_selected(true);
        if (expand)
            await this.set_expanded(true);
    }

    /**
     * @param item {RemoteItem}
     * @param expand {boolean}
     */
    async focus_item(item, expand = false) {
        if (!this.this_item())
            return console.error("Cannot focus : item is not initialized yet on {}", this);
        if (item.id === this.this_item().id) {
            this._set_selected(true);
            if (expand)
                await this.set_expanded(true);
            return;
        }
        if (this._expandable) {
            // Unroll hierarchy
            const hierarchy = [];
            hierarchy.push(item);
            while (hierarchy[hierarchy.length - 1].parent_item) {
                hierarchy.push(await item.get_pool().fetch_item(hierarchy[hierarchy.length - 1].parent_item))
            }
            await this._focus_item_internal(hierarchy, expand);
        }
    }

    clear_tree_selection() {
        const root = this.get_tree_root();
        if (root._selected) {
            root._selected.classList.remove('selected');
            delete root._selected;
        }
    }

    async set_expanded(expand) {
        if (!this._expandable)
            return;
        if (this._expanded === expand)
            return;

        if (this._expansion_promise)
            await this._expansion_promise;

        this._expansion_promise = new Promise(resolve => {
            this._expanded = expand;
            if (expand) {
                this.elements().content.style.display = 'flex';
                this.elements().arrow.classList.add('expanded');
                if (this._cached_divs) {
                    for (const div of this._cached_divs.values()) {
                        this._insert_child(div)
                    }
                    this._cached_divs = null;
                }
            }
            else {
                this.elements().content.style.display = 'none';
                this.elements().arrow.classList.remove('expanded');
            }
            resolve();
        })

        await this._expansion_promise;
    }

    /**
     * Create or re-create div elements
     * @private
     */
    _build_or_rebuild() {
        if (!this.isConnected)
            return;
        this.innerHTML = '';

        this.set_content(require('./tree_button.hbs'),
            {
                name: this.get_name(),
                expandable: this._expandable,
                icon: this.get_icon(),
            },
            {
                context: (event) => {
                    event.preventDefault();
                    this.context_menu();
                },
                open: async (event) => {
                    if (this._expandable) {
                        if (this.is_selected()) {
                            await this.set_expanded(!this.expanded());
                        } else if (!this.expanded())
                            await this.set_expanded(true);
                    }
                    if (!this.is_selected())
                        await this.open(false);
                    if (this.onclick && !this.is_selected())
                        this.onclick(event)
                },
                open_aux: async (event) => {
                    if (event.button === 1)
                        await this.open(true);
                }
            });
    }

    /**
     * Load content provider and fetch content.
     * Skipped if already called
     * @private
     */
    async _init_content_provider() {
        if (this._content_provider)
            return;
        this._content_provider = this.get_content();
        if (!this._content_provider)
            return;

        // Fetch content
        if (this._expandable) {
            const items = await this._content_provider.get_content();
            if (this.expanded()) {
                const request = new ContentRequest();
                for (const item of items)
                    request.directory_content([item.id]);
                await this.get_app().pool.fetch_content(request);
            }

            for (const item of items)
                if (!item.is_regular_file || this._show_regular_files)
                    this._add_item(item);
        }

        // Bind add and remove item (required to detect when we should add or remove arrow)
        this._on_add_item = this._content_provider.events.add('add', (item) => {
            this._add_item(item);
        })

        // Bind add and remove item (required to detect when we should add or remove arrow)
        this._on_remove_item = this.get_app().pool.events.add('remove_item', (item) => {
            this._remove_item(item);
        })
    }

    async _focus_item_internal(hierarchy, expand = false) {
        if (hierarchy.length === 0) {
            this._set_selected(true);
            if (expand)
                await this.set_expanded(true);
            return;
        }

        const item = hierarchy.pop();

        await this.set_expanded(true);
        const found_child = this._items.get(item.id);
        if (found_child)
            await found_child._focus_item_internal(hierarchy, expand);
        else {
            await this._focus_item_internal([], expand);
        }
    }

    _set_selected(select) {
        const root = this.get_tree_root();
        if ((root._selected === this) === select)
            return;

        this.clear_tree_selection();

        if (select) {
            root._selected = this;
            this.classList.add('selected');
        }
    }

    /**
     * @param a {TreeButton}
     * @param b {TreeButton}
     * @return number
     * @private
     */
    _compare_sort(a, b) {
        return -a.get_name().localeCompare(b.get_name());
    }

    _add_item(item) {
        if (!this._expandable)
            return;
        if (item.is_regular_file && !this._show_regular_files)
            return;
        if (this._items.get(item.id))
            return;
        if (!this._items || this._items.size === 0)
            this.elements().arrow.style.visibility = 'visible';

        const div = document.createElement('item-tree-button')
            .set_directory(item)
            .set_expandable(true);
        div._root = this.get_tree_root();
        this._items.set(item.id, div);
        if (this.expanded()) {
            this._insert_child(div);
        } else {
            if (!this._cached_divs)
                this._cached_divs = new Map();
            this._cached_divs.set(item.id, div);
        }
    }

    _insert_child(div) {
        let existing_children = Array.from(this.elements().content.children);
        let insertIndex = existing_children.findIndex(child => this._compare_sort(child, div) < 0);
        if (insertIndex === -1) {
            this.elements().content.appendChild(div);
        } else {
            this.elements().content.insertBefore(div, this.elements().content.children[insertIndex]);
        }
    }

    _remove_item(item) {
        if (!this._expandable)
            return;
        if (this._items.has(item.id)) {
            const div = this._items.get(item.id);
            if (div)
                div.remove();
            this._items.delete(item.id);
        }
        if (this._items.size === 0)
            this.elements().arrow.style.visibility = 'hidden';
    }

    /****************************************
     *              GETTERS                 *
     * **************************************/

    expanded() {
        return this._expandable && this._expanded;
    }

    /**
     * @returns {boolean}
     */
    is_selected() {
        return this.get_tree_root()._selected === this;
    }

    /**
     * @returns {TreeButton}
     */
    get_tree_root() {
        return this._root || this;
    }

    /****************************************
     *              VIRTUAL                 *
     * **************************************/


    /**
     * @return {String}
     */
    get_icon() { return "" }

    /**
     * @return {Repository | RemoteItem}
     */
    this_item() {}

    /**
     * @return {String}
     */
    get_name() { return "" }

    /**
     * Called when we desire to open context menu
     */
    context_menu() { }

    /**
     * @param new_tab {boolean}
     * @returns {Promise<void>}
     */
    async open(new_tab) {}

    /**
     * @return {ContentProvider}
     */
    async get_content() { return null; }
}

export {TreeButton};