
class Selector {
    constructor() {
        this.last_hover_item = null;
        this.hover_item_callbacks = [];

        /**
         * @type {Set<string>}
         */
        this.selected_items = new Set();
        this.last_selected_item = null;
        this.selected_item_callbacks = [];

        this.last_directory = undefined;

        /**
         * @callback callback_directory_changed
         * @param {string} new_item
         * @param {boolean} is_selected
         */

        /**
         * @type {callback_directory_changed[]}
         */
        this.changed_dir_callbacks = [];
    }

    set_hover_item(item) {
        if (item !== this.last_hover_item) {
            for (const callback of this.hover_item_callbacks)
                callback(item, this.last_hover_item)
        }
        this.last_hover_item = item;
    }

    get_hover_item() {
        return this.last_hover_item;
    }

    on_hover_item(callback) {
        this.hover_item_callbacks.push(callback)
    }

    /**
     * @param item {string}
     * @param shift_key {boolean}
     * @param ctrl_key {boolean}
     * @param force_select {boolean}
     */
    select_item(item, shift_key, ctrl_key, force_select= false) {
        this.last_selected_item = item;
        if (!shift_key) {
            if (ctrl_key) {
                if (this.selected_items.has(item) && !force_select) {
                    this.selected_items.delete(item);
                    for (const callback of this.selected_item_callbacks)
                        callback(item, false)
                } else {
                    this.selected_items.add(item);
                    for (const callback of this.selected_item_callbacks)
                        callback(item, true)
                }
            } else {
                const will_unselect = this.selected_items.has(item) && this.selected_items.size === 1 && !force_select;
                for (const last of this.selected_items)
                    for (const callback of this.selected_item_callbacks)
                        callback(last, false);
                this.selected_items.clear();
                if (!will_unselect) {
                    this.selected_items.add(item);
                    for (const callback of this.selected_item_callbacks)
                        callback(item, true)
                }
            }
        }
    }

    view_item(item) {
        if (!this.selected_items.has(item)) {
            this.selected_items.add(item);
            for (const callback of this.selected_item_callbacks)
                callback(item, true)
        }

    }

    clear_selection() {
        this.last_selected_item = null;
        for (const item of this.selected_items)
            for (const callback of this.selected_item_callbacks)
                callback(item, false);
        this.selected_items.clear();
    }

    /**
     * @param callback {callback_directory_changed}
     */
    bind_on_select_item(callback) {
        this.selected_item_callbacks.push(callback)
    }

    set_current_dir(item) {
        this.clear_selection();
        if (item !== this.last_directory) {
            for (const callback of this.changed_dir_callbacks)
                callback(item, this.last_directory)
        }
        this.last_directory = item;
    }

    get_current_directory() {
        return this.last_directory;
    }

    /**
     * @param callback {callback_directory_changed}
     */
    on_changed_dir(callback) {
        this.changed_dir_callbacks.push(callback)
    }
}

const selector = new Selector();

window.selector = selector
export {selector}