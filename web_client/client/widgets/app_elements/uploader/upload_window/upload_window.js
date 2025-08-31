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
            start_upload: async () => {
                this.get_app().upload_manager.set_uploading(true);
            },
            pause: async () => {
                this.get_app().upload_manager.set_uploading(!this.get_app().upload_manager.uploading());
            }
        });

        for (const [_, child] of this.get_app().upload_manager.children())
            this._add_item(child);

        this._add_item_event = this.get_app().upload_manager.events.add('add_item', (item) => this._add_item(item))
        this._uploading_event = this.get_app().upload_manager.events.add('uploading', (uploading) => {
            if (uploading) {
                this.elements().pause_img.src = '/public/images/icons/icons8-pause-30.png';
                this.elements().upload_button.style.display = 'none';
            } else {
                this.elements().pause_img.src = '/public/images/icons/icons8-play-64.png';
                if (this.get_app().upload_manager.children().size !== 0) {
                    this.elements().upload_button.style.display = 'flex';
                }
            }
        })
    }

    disconnectedCallback() {
        if (this._add_item_event)
            this._add_item_event.remove()
        delete this._add_item_event;
        if (this._uploading_event)
            this._uploading_event.remove()
        delete this._uploading_event;
    }

    _add_item(item) {
        if (!this.get_app().upload_manager.uploading())
            this.elements().upload_button.style.display = 'flex';
        if (item instanceof UploadRepository) {
            const item_view = document.createElement('upload-tree-item');
            item_view.set_item(item);
            this.elements().pending.append(item_view);
        }
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
                (await this.get_app().upload_manager.get_directory(target)).add_child(item)
        } else if (selection.repository)
            for (const item of items)
                this.get_app().upload_manager.get_repository(selection.repository).add_child(item);
    }
}

customElements.define('upload-window', UploadWindow);