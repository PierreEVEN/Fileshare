import {EventManager, GLOBAL_EVENTS} from "../../../../types/event_manager";
import {MemoryTracker} from "../../../../types/memory_handler";

class Selector extends MemoryTracker {
    /**
     * @param viewport {RepositoryViewport}
     */
    constructor(viewport) {
        super(Selector);
        this._selected_items = new Set();
        this.viewport = viewport;

        this.sorted_elements = [];

        this._add_content_event = viewport.content.events.add('add', (item) => {
            this.sorted_elements.push(item.id);
        });

        this._remove_content_event = viewport.content.events.add('remove', (item) => {
            if (this._last_selected === item.id)
                this._last_selected = null;
            for (const i in this.sorted_elements) {
                const id = this.sorted_elements[i];
                if (id === item.id) {
                    this.sorted_elements.splice(i, 1);
                    break;
                }
            }
            this._selected_items.delete(item.id);
        });

        this._last_selected = null;

        this.events = new EventManager();
    }

    delete() {
        super.delete();
        this._add_content_event.remove();
        this._add_content_event = null;
        this._remove_content_event.remove();
        this._remove_content_event = null;
    }

    /**
     * @param item_id {string}
     * @param local_edit {boolean}
     */
    unselect_item(item_id, local_edit) {

        if (!local_edit) {
            for (const item of this._selected_items) {
                this.unselect_item(item, true);
            }
        }

        this._last_selected = item_id;
        this._internal_unselect(item_id);
    }

    /**
     * @param item_id {string}
     * @param local_edit {boolean}
     * @param fill_space {boolean}
     */
    select_item(item_id, local_edit, fill_space) {
        if (!local_edit) {
            const last_selected = this._last_selected;
            for (const item of this._selected_items)
                this.unselect_item(item, true);
            this._last_selected = last_selected;
        }

        if (fill_space && this._last_selected !== null && this._last_selected !== undefined) {
            let start = -1;
            let end = -1;

            for (const i in this.sorted_elements)
                if (this.sorted_elements[i] === this._last_selected)
                    start = Number(i);

            for (const i in this.sorted_elements)
                if (this.sorted_elements[i] === item_id)
                    end = Number(i);

            if (start > end) {
                const tmp = end;
                end = start;
                start = tmp;
            }

            if (start >= 0 && end >= 0) {
                for (let i = start; i <= end; ++i) {
                    this._internal_select(this.sorted_elements[i]);
                }
            }
        } else {
            this._last_selected = item_id;
        }
        this._internal_select(item_id);
    }

    get_last_selected_item() {
        return this._last_selected;
    }

    async select_next(local_edit) {
        if (this.sorted_elements.length === 0)
            return;
        if (!this._last_selected)
            return this.select_item(this.sorted_elements[0], local_edit, false);

        let index = null;
        for (const item in this.sorted_elements)
            if (this.sorted_elements[item] === this._last_selected) {
                index = Number(item);
                break;
            }
        if (index === null || this.sorted_elements.length - 1 === index)
            return;
        return this.select_item(this.sorted_elements[index + 1], local_edit, false);
    }

    async select_previous(local_edit, fill_space) {
        if (this.sorted_elements.length === 0)
            return;
        if (!this._last_selected)
            return this.select_item(this.sorted_elements[this.sorted_elements.length - 1], local_edit, false);

        let index = null;
        for (const item in this.sorted_elements)
            if (this.sorted_elements[item] === this._last_selected) {
                index = Number(item);
                break;
            }
        if (index === null || index === 0)
            return;
        return this.select_item(this.sorted_elements[index - 1], local_edit, false);
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

    clear_selection() {
        for (const item of this._selected_items)
            this.unselect_item(item, true);
    }

    action_select(item_id, local_edit, fill_space) {
        if (this._selected_items.has(item_id)) {
            if (local_edit) {
                this.unselect_item(item_id, local_edit);
            } else if (!fill_space) {
                if (this._selected_items.size === 1)
                    this.unselect_item(item_id, false);
                else
                    this.select_item(item_id, false, false);
            }
        } else {
            this.select_item(item_id, local_edit, fill_space);
        }
    }

    _internal_select(item_id) {
        if (!this._selected_items.has(item_id)) {
            this._selected_items.add(item_id);
            this.viewport.get_div(item_id).classList.add('selected');
            this.events.broadcast('update_selection', item_id);
        }
    }

    _internal_unselect(item_id) {
        if (this._selected_items.has(item_id)) {
            this._selected_items.delete(item_id);
            this.viewport.get_div(item_id).classList.remove('selected');
            this.events.broadcast('update_selection', item_id);
        }
    }
}

export {Selector}