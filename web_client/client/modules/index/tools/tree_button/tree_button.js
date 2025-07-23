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
     * @return {FilesystemStream}
     */
    get_filesystem() { return null; }

    /**
     * @return {Repository | FilesystemItem}
     */
    this_item() {}

    /**
     * @param item {FilesystemItem}
     * @returns {boolean}
     */
    is_a_child(item) { return false; }

    /**
     * @return {Promise<Set<number>>}
     */
    async get_content() { return new Set(); }

    expanded() {
        return this._expandable && this._expanded;
    }

    generate_content() {
        if (!this.isConnected)
            return;
        this.innerHTML = '';
        if (!this.this_item())
            return;
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
                    await this.open();
                    if (this._expandable)
                        await this.set_expanded(!this._expanded);
                    if (this.onclick)
                        this.onclick(event)
                }
            });

        if (!this._fetch_sub_content && this._expandable) {
            this._fetch_sub_content = true;
            this.get_content().then(content => {
                if (content.size > 0) {
                    this.get_filesystem().fetch_item(Array.from(content)).then(items => {
                        if (this._show_regular_files) {
                            if (items.size !== 0)
                                this.elements().arrow.style.visibility = 'visible';
                        } else {
                            let dir_count = 0;
                            for (const element of items)
                                if (!element.is_regular_file)
                                    dir_count++;
                            if (dir_count !== 0)
                                this.elements().arrow.style.visibility = 'visible';
                        }
                    })
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

    async open() {}

    set_expandable(expandable) {
        if (this._expandable === expandable)
            return this;
        this._expandable = expandable;
        this.generate_content();
        return this;
    }

    /**
     * @param item
     */
    focus_item(item) {
        if (!this.this_item())
            return console.error("Cannot focus : item is not initialized yet on {}", this);
        if (item.id === this.this_item().id) {
            this.classList.add('selected');
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
            this._focus_item(hierarchy);
        }
        else
            this.classList.remove('selected');
    }

    _focus_item(hierarchy) {

        if (hierarchy.length === 0) {
            this.classList.add('selected');
            this.set_expanded(true);
            return;
        }

        const item = hierarchy.pop();

        this.set_expanded(true).then(() => {
            const found_child = this._items.get(item.id);
            if (found_child)
                found_child._focus_item(hierarchy);
            else {
                this._focus_item([]);
            }
        })
    }

    async set_expanded(expand) {
        if (!this._expandable)
            return;
        if (this._expanded === expand)
            return;

        if (this._expansion_promise)
            await this._expansion_promise;

        if (!this._expansion_promise)
            this._expansion_promise = new Promise(async resolve => {
                this._expanded = expand;
                if (expand) {
                    if (!this._initialized_content) {
                        this._initialized_content = true;
                        this._items = new Map();

                        const content = (await this.get_filesystem().fetch_item(Array.from(await this.get_content()))).sort(((a, b) => {
                            if (a.is_regular_file && !b.is_regular_file)
                                return 1;
                            else if (b.is_regular_file && !a.is_regular_file)
                                return -1;
                            return a.name.plain().localeCompare(b.name.plain())
                        }));

                        for (const item of content) {
                            this._add_item(item);
                        }
                        this._on_add_item = GLOBAL_EVENTS.add('add_item', (item) => {
                            if (this.is_a_child(item))
                                this._add_item(item);
                        })
                        this._on_remove_item = GLOBAL_EVENTS.add('remove_item', (item) => {
                            this._remove_item(item);
                        })
                    }
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
        delete this._expansion_promise;
    }

    _add_item(item) {
        if (!this._expandable)
            return;
        if (item.is_regular_file && !this._show_regular_files)
            return;
        if (this._items.size === 0)
            this.elements().arrow.style.visibility = 'visible';
        const div = document.createElement('item-tree-button')
            .set_directory(item)
            .set_expandable(true);
        this.elements().content.append(div);
        this._items.set(item.id, div);
    }

    _remove_item(item) {
        if (!this._expandable)
            return;
        if (this._items.has(item.id)) {
            this._items.get(item.id).remove();
            this._items.delete(item.id);
        }
        if (this._items.size === 0)
            this.elements().arrow.style.visibility = 'hidden';
    }
}

export {TreeButton};