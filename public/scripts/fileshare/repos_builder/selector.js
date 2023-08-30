class Selector {
    constructor() {
        this.last_hover_item = null;
        this.hover_item_callbacks = [];

        this.last_selected_item = null;
        this.selected_item_callbacks = [];
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

    on_select_item(callback) {
        this.selected_item_callbacks.push(callback)
    }
}

const selector = new Selector();

export {selector}