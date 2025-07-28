import {AppWidget} from "../../../../app_widget";
import {GLOBAL_EVENTS} from "../../../../types/event_manager";

require('./tree_button.scss')

class TreeButton extends AppWidget {
    constructor() {
        super();

        if (this.hasAttribute('expandable'))
            this._expandable = true;

        if (this.hasAttribute('show_regular_files'))
            this._show_regular_files = true;

        this._expanded = false;
        this._in_trash = false;
        this._items = new Map();
    }

    connectedCallback() {
        this.className = 'tree-button';
        this.generate_content();
    }

    disconnectedCallback() {
        if (this._on_add_item)
            this._on_add_item.remove();
        if (this._on_remove_item)
            this._on_remove_item.remove();
    }

    /**
     * @return {String}
     */
    get_icon() { return "" }

    /**
     * @return {Repository | FilesystemItem}
     */
    this_item() {}

    /**
     * @return {ContentProvider}
     */
    async get_content() { return null; }

    expanded() {
        return this._expandable && this._expanded;
    }

    generate_content() {
        if (!this.isConnected)
            return;
        this.innerHTML = '';
        if (!this.this_item())
            return;

        if (this._on_add_item)
            this._on_add_item.remove();
        if (this._on_remove_item)
            this._on_remove_item.remove();

        /**
         * @type {ContentProvider}
         * @private
         */
        this._content_provider = this.get_content();
        this._content_provider.id = Math.random();

        // Bind add and remove item (required to detect when we should add or remove arrow)
        this._on_add_item = this._content_provider.events.add('add', (item) => {
            this._add_item(item);
        })

        // Bind add and remove item (required to detect when we should add or remove arrow)
        this._on_remove_item = GLOBAL_EVENTS.add('remove_item', (item) => {
            this._remove_item(item);
        })


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
                    if (this._expandable)
                        await this.set_expanded(!this._expanded);
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

        if (!this._fetch_sub_content && this._expandable) {
            this._fetch_sub_content = true;

            // Fetch a first time to display or not expand arrow
            this._content_provider.get_content().then(items => {
                if (items.length > 0) {
                    if (this._show_regular_files) {
                        if (items.length !== 0)
                            this.elements().arrow.style.visibility = 'visible';
                    } else {
                        let dir_count = 0;
                        for (const element of items)
                            if (!element.is_regular_file)
                                dir_count++;
                        if (dir_count !== 0)
                            this.elements().arrow.style.visibility = 'visible';
                    }
                }
                this._fetch_sub_content = false;
            });
        }

        return this;
    }

    /**
     * @return {String}
     */
    get_name() { return "" }

    context_menu() { }

    async open(new_tab) {}

    set_expandable(expandable) {
        if (this._expandable === expandable)
            return this;

        this._expandable = expandable;
        this.generate_content();
        return this;
    }

    display_trash(enable) {
        if (this._in_trash === enable)
            return this;
        this._in_trash = enable;
        this.generate_content();
        return this;
    }

    show_regular_files(enable) {
        if (this._show_regular_files === enable)
            return this;
        this._show_regular_files = enable;
        this.generate_content();
        return this;
    }

    is_in_trash() {
        return this._in_trash;
    }

    /**
     * @param in_trash {boolean}
     * @param expand {boolean}
     */
    focus_root(in_trash, expand = false) {
        if (in_trash) {
            this._trash_div._select(true);
            if (expand)
                this._trash_div.set_expanded(true);
        } else {
            this._select(true);
            if (expand)
                this.set_expanded(true);
        }
    }

    /**
     * @param item {FilesystemItem}
     * @param expand {boolean}
     */
    focus_item(item, expand = false) {
        if (!this.this_item())
            return console.error("Cannot focus : item is not initialized yet on {}", this);
        if (item.id === this.this_item().id) {
            this._select(true);
            if (expand)
                this.set_expanded(true);
            return;
        }
        if (this._expandable) {
            // Unroll hierarchy
            const hierarchy = [];
            hierarchy.push(item);
            while (hierarchy[hierarchy.length - 1].parent_item) {
                hierarchy.push(item.filesystem().find(hierarchy[hierarchy.length - 1].parent_item))
            }
            this._focus_item(hierarchy, expand);
        }
    }

    _focus_item(hierarchy, expand = false) {
        if (hierarchy.length === 0) {
            this._select(true);
            if (expand)
                this.set_expanded(true);
            return;
        }

        const item = hierarchy.pop();

        this.set_expanded(true).then(() => {
            const found_child = this._items.get(item.id);
            if (found_child)
                found_child._focus_item(hierarchy, expand);
            else {
                this._focus_item([], expand);
            }
        })
    }

    clear_selection() {
        const root = this.get_tree_root();
        if (root._selected) {
            root._selected.classList.remove('selected');
            delete root._selected;
        }
    }

    _select(select) {
        const root = this.get_tree_root();
        if ((root._selected === this) === select)
            return;

        this.clear_selection();

        if (select) {
            root._selected = this;
            this.classList.add('selected');
        }
    }

    is_selected() {
        return this.get_tree_root()._selected === this;
    }

    get_tree_root() {
        return this._root || this;
    }

    async set_expanded(expand) {
        if (!this._expandable)
            return;
        if (this._expanded === expand)
            return;

        if (this._expansion_promise)
            await this._expansion_promise;

        this._expansion_promise = new Promise(async resolve => {
            this._expanded = expand;
            if (expand) {
                await this._initialize_content();
                this.elements().content.style.display = 'flex';
                this.elements().arrow.classList.add('expanded');
            }
            else {
                this.elements().content.style.display = 'none';
                this.elements().arrow.classList.remove('expanded');
            }
            resolve();
        })

        await this._expansion_promise;
    }

    async _initialize_content() {
        if (!this._initialized_content) {
            this._initialized_content = true;

            const content = (await this._content_provider.get_content()).sort(((a, b) => {
                if (a.is_regular_file && !b.is_regular_file)
                    return 1;
                else if (b.is_regular_file && !a.is_regular_file)
                    return -1;
                return a.name.plain().localeCompare(b.name.plain())
            }));

            for (const item of content)
                this._add_item(item);

            if (this.this_item().constructor.name === 'Repository' && !this.is_in_trash()) {
                this._trash_div = document.createElement('repository-tree-button')
                    .set_repository(this.this_item())
                    .set_expandable(true)
                    .show_regular_files(true)
                    .display_trash(true);
                this._trash_div._root = this.get_tree_root();
                this.elements().content.append(this._trash_div);
            }
        }
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
        if (this.expanded()) {
            const div = document.createElement('item-tree-button')
                .set_directory(item)
                .set_expandable(true)
                .display_trash(this.is_in_trash());
            div._root = this.get_tree_root();
            this.elements().content.append(div);
            this._items.set(item.id, div);
        } else {
            this._items.set(item.id, null);
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
}

export {TreeButton};