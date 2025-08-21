import {EventManager} from "../../../src/event_manager";

class Selector {
    /**
     * @param content {HTMLCollection}
     */
    constructor(content) {
        /**
         * @type {Set<number>}
         * @private
         */
        this._selected_items = new Set();
        /**
         * @type {number|null}
         * @private
         */
        this._last_selected = null;

        /**
         * @type {HTMLCollection}
         */
        this.content = content;

        this.events = new EventManager();
    }

    /**
     * @param item_id {number}
     * @param local_edit {boolean}
     */
    async unselect_item(item_id, local_edit) {
        if (!local_edit) {
            for (const item of this._selected_items) {
                await this.unselect_item(item, true);
            }
        }

        this._last_selected = item_id;
        await this._internal_unselect(item_id);
    }

    /**
     * @param item_id {number}
     * @param local_edit {boolean}
     * @param fill_space {boolean}
     */
    async select_item(item_id, local_edit, fill_space) {
        if (!local_edit) {
            const last_selected = this._last_selected;
            for (const item of this._selected_items)
                await this.unselect_item(item, true);
            this._last_selected = last_selected;
        }

        if (fill_space && this._last_selected !== null && this._last_selected !== undefined) {

            let start = this.find_item_view_by_id(this._last_selected);
            let end = this.find_item_view_by_id(item_id);

            if (start && end) {

                const content = Array.from(this.content);
                const start_index = content.indexOf(start);
                const end_index = content.indexOf(end);
                if (start_index > end_index) {
                    const tmp = end;
                    end = start;
                    start = tmp;
                }

                while (start && start !== end) {
                    await this._internal_select(start.item().id);
                    start = start.nextElementSibling;
                }
                await this._internal_select(end.item().id);
            }
        } else {
            this._last_selected = item_id;
        }
        await this._internal_select(item_id);
    }

    /**
     * @param id {number}
     * @return {ItemView}
     */
    find_item_view_by_id(id) {
        for (const div of this.content)
            if (div.item().id === id)
                return div;
        return null;
    }

    /**
     * @returns {number|null}
     */
    get_last_selected_item() {
        return this._last_selected;
    }

    async select_next(local_edit) {
        if (this.content.length === 0)
            return;

        const last_selected = this._last_selected ? this.find_item_view_by_id(this._last_selected) : this.content[0];
        let next = last_selected ? last_selected.nextElementSibling : null;
        if (!next)
            next = this.content[0];

        await this.select_item(next.item().id, local_edit, false);
    }

    async select_previous(local_edit) {
        if (this.content.length === 0)
            return;

        const last_selected = this._last_selected ? this.find_item_view_by_id(this._last_selected) : this.content[this.content.length - 1];
        let previous = last_selected.previousElementSibling;
        if (!previous)
            previous = this.content[this.content.length - 1];

        await this.select_item(previous.item().id, local_edit, false);
    }

    is_selected(item_id) {
        return this._selected_items.has(item_id);
    }

    /**
     * @return {number[]}
     */
    get_selected_items() {
        return Array.from(this._selected_items);
    }

    async clear_selection() {
        for (const item of this._selected_items)
            await this.unselect_item(item, true);
    }

    async action_select(item_id, local_edit, fill_space) {
        if (this._selected_items.has(item_id)) {
            if (local_edit) {
                await this.unselect_item(item_id, local_edit);
            } else if (!fill_space) {
                if (this._selected_items.size === 1)
                    await this.unselect_item(item_id, false);
                else
                    await this.select_item(item_id, false, false);
            }
        } else {
            await this.select_item(item_id, local_edit, fill_space);
        }
    }

    async _internal_select(item_id) {
        if (!this._selected_items.has(item_id)) {
            this._selected_items.add(item_id);
            const div = this.find_item_view_by_id(item_id);
            if (div) {
                div.classList.add('selected');
                div.scrollIntoView({behavior: "smooth", block: "nearest"})
            }
            await this.events.broadcast('update_selection', item_id);
        }
    }

    async _internal_unselect(item_id) {
        if (this._selected_items.has(item_id)) {
            this._selected_items.delete(item_id);
            const div = this.find_item_view_by_id(item_id);
            if (div)
                div.classList.remove('selected');
            await this.events.broadcast('update_selection', item_id);
        }
    }
}

export {Selector}