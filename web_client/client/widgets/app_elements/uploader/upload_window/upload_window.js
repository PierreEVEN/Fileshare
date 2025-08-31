import {AppWidget} from "../../../../src/app_widget";

import './upload/upload'
import {select_files_or_directories} from "./file_picker";
import {UploadRepository} from "../upload_tree/upload_repository";

import './tree_view/upload_tree_item'

require('./upload_window.scss')

class UploadWindow extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_content(require('./upload_window.hbs'), {}, {
            add_files: async () => {
                await this.add_items(await select_files_or_directories(this.get_app().upload_manager, false));
            },
            add_directory: async () => {
                await this.add_items(await select_files_or_directories(this.get_app().upload_manager, true));
            },
        });

        for (const [id, child] of this.get_app().upload_manager.children())
            this._add_item(child);

        this.get_app().upload_manager.events.add('add_item', (item) => this._add_item(item))

        this.get_app().upload_manager.events.add('remove_item', (item) => this._remove_item(item))
    }

    _add_item(item) {
        if (item instanceof UploadRepository) {
            const item_view = document.createElement('upload-tree-item');
            item_view.set_item(item);
            this.elements().pending.append(item_view);
        }
    }

    _remove_item(item) {

    }

    disconnectedCallback() {

    }

    /**
     * @param items {UploadItem[]}
     * @returns {Promise}
     */
    async add_items(items) {
        const selection = this.get_app().state.selection();
        if (selection.item) {
            let target = selection.item.is_regular_file ? await this.get_app().pool.fetch_item(selection.item.parent_item) : selection.item;
            for (const item of items)
                this.get_app().upload_manager.get_directory(target).add_child(item)
        } else if (selection.repository)
            for (const item of items)
                this.get_app().upload_manager.get_repository(selection.repository).add_child(item);
    }
}

customElements.define('upload-window', UploadWindow);