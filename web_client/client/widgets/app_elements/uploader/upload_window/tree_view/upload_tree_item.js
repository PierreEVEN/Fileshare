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

        this._add_event = this.get_app().upload_manager.events.add('add_item', (item) => this._add_item(item))
        this._remove_event = this.get_app().upload_manager.events.add('remove_item', (item) => {
            if (item === this._item)
                this.remove();
        })
    }

    disconnectedCallback() {
        if (this._add_event)
            this._add_event.remove();
        delete this._add_event;
        if (this._remove_event)
            this._remove_event.remove();
        delete this._remove_event;
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
                this._item.remove();
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
            /**
             * @param a {UploadItem}
             * @param b {UploadItem}
             * @return number
             * @private
             */
            const compare_sort = (a, b) => {
                if (a instanceof UploadFile && b instanceof UploadDirectory)
                    return -1;
                if (b instanceof UploadFile && a instanceof UploadDirectory)
                    return 1;
                return -a.name().localeCompare(b.name());
            }

            const item_view = document.createElement('upload-tree-item');
            item_view.set_item(item);
            let existing_children = Array.from(this.elements().content.children);
            let insertIndex = existing_children.findIndex(child => compare_sort(child._item, item) < 0);
            if (insertIndex === -1) {
                this.elements().content.appendChild(item_view);
            } else {
                this.elements().content.insertBefore(item_view, this.elements().content.children[insertIndex]);
            }
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