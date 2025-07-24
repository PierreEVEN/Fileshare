import {TreeButton} from "./tree_button";
import {context_menu_item} from "../../context_menu/contexts/context_item";
import {get_mime_icon_path} from "../../../../utilities/mime_utils";
import {Repository} from "../../../../types/repository";
import {DirectoryContentProvider} from "../../../../types/viewport_content/providers";

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

    async open(new_tab) {
        if (this._item) {
            if (this.is_in_trash()) {
                if (new_tab)
                    window.open(await (await Repository.find(this.get_app(), this._item.repository)).trash_url(this.get_app()));
                else
                    await this.get_app().set_display_trash(await Repository.find(this.get_app(), this._item.repository));
            } else {
                if (new_tab)
                    window.open(await this._item.url(this.get_app()));
                else
                    await this.get_app().set_display_item(this._item);
            }
        }
    }

    async is_a_child(item) {
        if (!this._item || this.is_in_trash())
            return false;
        return item.parent_item === this._item.id;
    }

    get_content() {
        return new DirectoryContentProvider(this._item);
        /*
        if (!this._item || this._item.is_regular_file)
            return new Set()
        return await this._item.filesystem().directory_content(this._item.id)*/
    }

    get_filesystem() {
        return this._item ? this._item.filesystem() : null;
    }
}

customElements.define('item-tree-button', ItemTreeButton);