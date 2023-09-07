/**
 * @callback callback_directory_changed
 * @param {Directory} new_dir
 * @param {Directory} old_dir
 */
import {close_message, parse_fetch_result, print_message} from "./widgets/message_box";


class Selector {
    constructor() {
        this.last_hover_item = null;
        this.hover_item_callbacks = [];

        this.last_selected_item = null;
        this.selected_item_callbacks = [];

        this.last_directory = null;
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


    set_selected_item(item) {
        if (item !== this.last_selected_item) {
            for (const callback of this.selected_item_callbacks)
                callback(item, this.last_selected_item)
        }
        this.last_selected_item = item;
    }

    get_selected_item() {
        return this.last_selected_item;
    }

    /**
     * @param callback {callback_directory_changed}
     */
    on_select_item(callback) {
        this.selected_item_callbacks.push(callback)
    }

    set_current_dir(item) {
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