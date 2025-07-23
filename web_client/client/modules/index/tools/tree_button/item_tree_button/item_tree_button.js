import {TreeButton} from "../tree_button";
import {context_menu_item} from "../../../context_menu/contexts/context_item";
import {get_mime_icon_path} from "../../../../../utilities/mime_utils";

class ItemTreeButton extends TreeButton {
    /**
     * @param item {FilesystemItem}
     */
    set_directory(item) {
        /**
         * @type {FilesystemItem}
         * @private
         */
        /**
         * @type {Repository}
         * @private
         */
        if (this._item && item && this._item.id === item.id && this.isConnected)
            return this;
        this._item = item;
        this.generate_content();
        return this;
    }

    get_name() {
        return this._item ? this._item.name.plain() : '';
    }

    this_item() {
        return this._item;
    }

    get_icon() {
        if (!this._item)
            return '';
        if (this._item.is_regular_file)
            return get_mime_icon_path(this._item.mimetype.plain())
        else
            return '/public/images/icons/icons8-folder-96.png';
    }

    context_menu() {
        if (this._item)
            context_menu_item(this.get_app(), this._item);
    }

    async open() {
        if (this._item)
            await this.get_app().set_display_item(this._item);
    }

    is_a_child(item) {
        if (!this._item)
            return false;
        return item.parent_item === this._item.id;
    }

    async get_content() {
        if (!this._item || this._item.is_regular_file)
            return new Set()
        return await this._item.filesystem().directory_content(this._item.id)
    }

    get_filesystem() {
        return this._item ? this._item.filesystem() : null;
    }
}

customElements.define('item-tree-button', ItemTreeButton);