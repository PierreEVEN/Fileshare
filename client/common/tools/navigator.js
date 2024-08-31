import {PAGE_CONTEXT} from "./utils";
import {parse_fetch_result} from "../../layout/widgets/components/message_box";

class Navigator {
    /**
     * @param repos_builder {ReposBuilder}
     */
    constructor(repos_builder) {
        this.last_hover_item = null;
        this.hover_item_callbacks = [];

        /**
         * @type {Set<number>}
         */
        this.selected_items = new Set();
        this.last_selected_item = null;
        this.selected_item_callbacks = [];

        this.current_directory = undefined;

        /**
         * @callback callback_directory_changed
         * @param {number} new_item
         * @param {boolean} is_selected
         */

        /**
         * @type {callback_directory_changed[]}
         */
        this.changed_dir_callbacks = [];

        /**
         * @type {Filesystem}
         */
        this.filesystem = repos_builder.filesystem;

        /**
         * @type {ReposBuilder}
         */
        this.repos_builder = repos_builder;
    }

    set_hover_item(item) {
        if (item !== this.last_hover_item) {
            for (const callback of this.hover_item_callbacks) callback(item, this.last_hover_item)
        }
        this.last_hover_item = item;
    }

    get_hover_item() {
        return this.last_hover_item;
    }

    on_hover_item(callback) {
        this.hover_item_callbacks.push(callback)
    }

    enter_touch_selection_mode(enter = true) {
        this.is_touch_selection_mode = enter;
        if (enter) {
            document.getElementById('mobile-selection-header').classList.add('mobile-selection-mode');
            document.getElementById('mobile-selection-close-button').onclick = () => {
                this.enter_touch_selection_mode(false);
            }
            const action_div = document.getElementById('mobile-selection-action-buttons');
            action_div.innerHTML = '';
            const cut_button = document.createElement('button');
            const cut_image = document.createElement('img');
            cut_image.src = '/images/icons/icons8-cut-48.png'
            cut_button.append(cut_image)
            cut_button.onclick = () => {
                this.cut_selection()
            }
            cut_button.classList.add('plus-button')
            action_div.append(cut_button);

            const remove_button = document.createElement('button');
            const remove_image = document.createElement('img');
            remove_image.src = '/images/icons/icons8-trash-52.png'
            remove_button.append(remove_image)
            remove_button.classList.add('cancel-button')
            action_div.append(remove_button);

        } else {
            this.is_touch_selection_mode = false;
            document.getElementById('mobile-selection-header').classList.remove('mobile-selection-mode');
            this.clear_selection();
        }
    }

    /**
     * @param item {number}
     * @param shift_key {boolean}
     * @param ctrl_key {boolean}
     * @param force_select {boolean}
     */
    select_item(item, shift_key, ctrl_key, force_select = false) {
        if (shift_key) {
            if (!this.last_selected_item)
                this.last_selected_item = item;
            const dir_content = this.repos_builder.directory_content;
            let start_index = 0;
            for (const i in dir_content.objects)
                if (dir_content.objects[i].id === item)
                    start_index = Number(i);
            let end_index = 0;
            for (const i in dir_content.objects)
                if (dir_content.objects[i].id === this.last_selected_item)
                    end_index = Number(i);

            // Swap if needed
            if (start_index > end_index)
                [start_index, end_index] = [end_index, start_index];

            const items_to_keep_selected = new Set();
            for (let i = start_index; i <= end_index; ++i)
                items_to_keep_selected.add(dir_content.objects[i].id)

            if (!ctrl_key && !force_select)
                for (const selected of this.selected_items)
                    if (!items_to_keep_selected.has(selected))
                        this._select_item_internal(selected, false);

            for (const item of items_to_keep_selected)
                this._select_item_internal(item, true);
        } else {
            this.last_selected_item = item;
            if (ctrl_key || this.is_touch_selection_mode || (force_select && this.selected_items.has(item))) {
                if (this.selected_items.has(item))
                    this._select_item_internal(item, force_select);
                else
                    this._select_item_internal(item, true);
            } else {
                for (const elem of this.selected_items)
                    if (elem !== item)
                        this._select_item_internal(elem, false);
                if (this.selected_items.has(item))
                    this._select_item_internal(item, force_select);
                else
                    this._select_item_internal(item, true);
            }
        }
    }

    _select_item_internal(item, selected) {
        if (selected && !this.selected_items.has(item)) {
            this.selected_items.add(item);
            for (const callback of this.selected_item_callbacks) callback(item, true)
        } else if (!selected && this.selected_items.has(item)) {
            this.selected_items.delete(item);
            for (const callback of this.selected_item_callbacks) callback(item, false)
        }

        if (this.is_touch_selection_mode) {
            document.getElementById('mobile-selection-info').innerText = `${this.selected_items.size}`
            if (this.selected_items.size === 0) {
                this.enter_touch_selection_mode(false)
            }
        }
    }

    view_item(item) {
        if (!this.selected_items.has(item)) {
            this.selected_items.add(item);
            for (const callback of this.selected_item_callbacks) callback(item, true)
        }
    }

    clear_selection() {
        if (this.is_touch_selection_mode) this.enter_touch_selection_mode(false);
        this.last_selected_item = null;
        for (const item of this.selected_items) for (const callback of this.selected_item_callbacks) callback(item, false);
        this.selected_items.clear();
    }

    /**
     * @param callback {callback_directory_changed}
     */
    bind_on_select_item(callback) {
        this.selected_item_callbacks.push(callback)
    }

    set_current_dir(item, skip_push_state = false) {
        this.last_hover_item = null;
        this.last_selected_item = null;
        this.clear_selection();
        if (item !== this.current_directory) {
            this.current_directory = item;
            for (const callback of this.changed_dir_callbacks)
                callback(item)
            if (!skip_push_state) {
                history.pushState(item, "", `${PAGE_CONTEXT.repos_path()}/tree${this.get_string_path_to_directory(item)}`);
            }
        }
    }

    get_string_path_to_directory(item) {
        let full_path_string = "/";
        for (const dir of this.filesystem.make_path_to_object(item)) {
            const dir_data = this.filesystem.get_object_data(dir);
            full_path_string += dir_data.name.plain() + "/";
        }
        return full_path_string;
    }

    get_current_directory() {
        return this.current_directory;
    }

    /**
     * @param callback {callback_directory_changed}
     */
    on_changed_dir(callback) {
        this.changed_dir_callbacks.push(callback)
    }

    cut_selection() {
        /**
         * @type {number[]}
         */
        this.clipboard_items = Array.from(this.selected_items);
        this.clear_selection();
    }

    /**
     * @param parent_id {number | null}
     * @returns {Promise<void>}
     */
    async move_clipboard_to_parent(parent_id) {
        if (!this.clipboard_items || this.clipboard_items.length === 0)
            return;
        const res = await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/move-item/${parent_id ? parent_id : ''}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                item_ids: this.clipboard_items
            })
        }));
        if (!res.message) {
            for (const item of this.clipboard_items) {
                const old_item = this.filesystem.get_object_data(item);
                this.filesystem.remove_object(item, true)
                old_item.parent_item = parent_id;
                this.filesystem.add_object(old_item);
            }
        }
        delete this.clipboard_items;
    }
}

export {Navigator}