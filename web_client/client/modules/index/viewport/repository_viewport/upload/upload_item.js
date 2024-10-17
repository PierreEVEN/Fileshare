import {Repository} from "../../../../../types/repository";
import {fetch_api} from "../../../../../utilities/request";
import {EncString} from "../../../../../types/encstring";
import {FilesystemItem} from "../../../../../types/filesystem_stream";
import {overwrite_or_restore} from "../../../tools/item_conflict/item_conflict";
import {Message, NOTIFICATION} from "../../../tools/message_box/notification";
import mime from 'mime';

class UploadItem {
    constructor(data) {
        this.is_regular_file = data.is_regular_file;
        /**
         * @type {String}
         */
        this.name = data.name;
        /**
         * @type {File}
         */
        this.file = data.file;
        this.children = new Map();
        this.expanded = false;
        /**
         * @type {UploadItem|Uploader}
         */
        this.parent = null;
        /**
         * @type {FilesystemItem}
         */
        this.directory = data.directory;
        /**
         * @type {String}
         */
        this.mimetype = data.mimetype;

        this.total_items = this.file ? 1 : 0;
        this.total_size = this.file ? this.file.size : 0;
    }

    instantiate(container) {
        this.div = require("./item.hbs")({data: this, directory: !this.is_regular_file}, {
            expand: () => {
                this.set_expanded(!this.expanded)
            },
            remove: () => {
                this.remove();
            }
        });
        this._elements = this.div.elements;
        container.append(this.div)
    }

    set_expanded(expand) {
        this.expanded = expand;
        this._elements.content.innerHTML = '';
        if (expand) {
            for (const child of this.children.values())
                if (!child.is_regular_file)
                    child.instantiate(this._elements.content);
            for (const child of this.children.values())
                if (child.is_regular_file)
                    child.instantiate(this._elements.content);
            this.div.classList.add('expand');
        } else {
            this.div.classList.remove('expand');
        }
        for (const child of this.children.values()) {
            child.expanded = false;
        }
    }

    /**
     * @param fs_drop {FileSystemEntry}
     * @return {Promise<UploadItem>}
     * @constructor
     */
    static async FromFilesystemDrop(fs_drop) {
        let file = null;
        if (fs_drop.isFile) {
            file = await new Promise((resolve) => {
                fs_drop.file(file => {
                    resolve(file);
                })
            })
            if (!file.type)
                file.mimetype = mime.getType(file.name);
            else
                file.mimetype = file.type;
        }
        return new UploadItem({
            is_regular_file: fs_drop.isFile,
            name: fs_drop.name,
            file: file,
            mimetype: file ? file.mimetype : '',
            directory: null
        });
    }


    /**
     * @param file {File|null}
     * @param name {string}
     * @return {UploadItem}
     * @constructor
     */
    static FromUploadModal(name, file = null) {
        if (file && !file.type)
            file.mimetype = mime.getType(file.name);
        else
            file.mimetype = file.type;
        return new UploadItem({
            is_regular_file: !!file,
            name: name,
            file: file,
            mimetype: file ? file.mimetype : '',
            directory: null
        });
    }

    /**
     * @param directory {FilesystemItem}
     * @return {UploadItem}
     * @constructor
     */
    static FromRepositoryDirectory(directory) {
        return new UploadItem({
            is_regular_file: false,
            name: directory.name.plain(),
            file: null,
            directory: directory
        });
    }

    /**
     * @param item {UploadItem}
     */
    add_child(item) {
        if (this.children.has(item.name))
            return;
        this.children.set(item.name, item);
        item.parent = this;
        if (this.expanded) {
            item.instantiate(this._elements.content)
        }
        this.parent_add_stats(item.total_size, item.total_items);
    }

    parent_add_stats(size, count) {
        if (this.parent)
            this.parent.parent_add_stats(size, count);
        this.total_items += count;
        this.total_size += size;
    }

    _remove_child(name) {
        this.children.delete(name);
        if (this.directory && this.children.size === 0)
            this.remove();
    }

    remove() {
        if (this.div)
            this.div.remove();
        this.parent._remove_child(this.name);
        this.parent_add_stats(-this.total_size, -this.total_items);
    }

    /**
     * @param filesystem {FilesystemStream}
     * @return {Promise<void>}
     */
    async create_directory(filesystem) {
        if (this.directory)
            return;
        if (this.parent instanceof UploadItem) {
            if (!this.parent.directory) {
                await this.parent.create_directory(filesystem);
            }
            if (!this.parent.directory) {
                console.error(`Failed to create parent directory for : ${this.parent.name}`);
                return;
            }
            this.directory = await this._get_or_create_dir(this.name, this.parent.directory.repository, this.parent.directory.id);
        } else {
            this.directory = await this._get_or_create_dir(this.name, this.parent.viewport.repository.id, null);
        }
    }

    /**
     * @param name {string}
     * @param repository_id {number}
     * @param parent {number|null}
     * @return {Promise<FilesystemItem>}
     * @private
     */
    async _get_or_create_dir(name, repository_id, parent) {
        const repository = await Repository.find(repository_id);
        let parent_entry = parent ? await repository.content.fetch_item(parent) : null;
        const existing = await repository.content.find_child(name, parent_entry);
        if (existing) {
            if (existing.in_trash) {
                const res = (await overwrite_or_restore(existing.name.plain(), existing));
                if (res.canceled) {
                    throw "Annulé : le dossier parent n'existe pas"
                }
            }
            return existing;
        }

        const directories = await fetch_api('item/new-directory/', 'POST',
            [{
                name: EncString.from_client(name),
                repository: repository_id,
                parent_item: parent
            }]
        ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dossier")));
        if (directories.length === 1) {
            return await FilesystemItem.new(directories[0]);
        }
    }
}

export {UploadItem}