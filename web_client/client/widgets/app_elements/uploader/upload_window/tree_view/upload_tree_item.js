import {AppWidget} from "../../../../../src/app_widget";
import {UploadRepository} from "../../upload_tree/upload_repository";
import {UploadDirectory} from "../../upload_tree/upload_directory";
import {get_mime_icon_path} from "../../../../../src/utilities/mime_utils";
import {UploadFile} from "../../upload_tree/upload_file";

require('./upload_tree_item.scss')

class UploadTreeItem extends AppWidget {
    constructor() {
        super();

        this._expanded = false;
    }

    connectedCallback() {
        this.set_item(this._item);


        this.get_app().upload_manager.events.add('add_item', (item) => this._add_item(item))

        this.get_app().upload_manager.events.add('remove_item', (item) => this._remove_item(item))
    }

    /**
     * @param item {UploadItem}
     */
    async set_item(item) {
        this._item = item;
        if (!this.isConnected)
            return;
        if (!item)
            return;
        const repository = item instanceof UploadRepository;
        const directory = item instanceof UploadDirectory;
        const mime_icon_path = item instanceof UploadFile ? get_mime_icon_path(await item.mimetype()) : '';
        this.set_content(require('./upload_tree_item.hbs'), {
            repository,
            directory,
            name: item.name(),
            mime_icon: mime_icon_path
        }, {
            expand: () => {
                this.set_expanded(!this._expanded)
            },
            remove: () => {

            }
        });
    }

    /**
     * @param item {UploadItem}
     * @private
     */
    _add_item(item) {
        if (!this._expanded)
            return;

        if (item.parent === this._item) {
            const item_view = document.createElement('upload-tree-item');
            item_view.set_item(item);
            this.elements().content.append(item_view);
        }
    }

    set_expanded(expand) {
        this._expanded = expand;
        this._elements.content.innerHTML = '';
        if (expand) {
            this.classList.add('expand');
            for (const [id, child] of this._item.children())
                this._add_item(child);
        } else {
            this.classList.remove('expand');
        }
    }
}

customElements.define('upload-tree-item', UploadTreeItem);