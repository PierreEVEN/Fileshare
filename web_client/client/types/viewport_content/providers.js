import {ContentProvider} from "./viewport_content";

class RepositoryRootProvider extends ContentProvider {
    /**
     * @param repository {Repository}
     */
    constructor(repository) {
        super();
        this.repository = repository;
    }

    async get_content() {
        const items = [];
        for (const item_id of await this.repository.content.root_content()) {
            const item = await this.repository.content.fetch_item(item_id);
            if (!item.in_trash)
                items.push(item);
        }
        return items;
    }

    _internal_add_item(item) {
        if (!item.in_trash && item.parent_item === undefined && item.repository === this.repository.id)
            this.events.broadcast('add', item);
    }
}

class DirectoryContentProvider extends ContentProvider {
    /**
     * @param directory {FilesystemItem}
     */
    constructor(directory) {
        super();
        console.assert(!directory.is_regular_file, "Cannot open a file as a directory");
        /**
         * @type {FilesystemItem}
         */
        this.directory = directory;
    }

    async get_content() {
        const items = [];
        const fs = this.directory.filesystem();
        for (const item_id of await fs.directory_content(this.directory.id)) {
            const item = await fs.fetch_item(item_id);
            if (!item.in_trash)
                items.push(item);
        }
        return items;
    }

    _internal_add_item(item) {
        super._internal_add_item(item);
        if (!item.in_trash && item.parent_item === this.directory.id)
            this.events.broadcast('add', item);
    }

    delete() {
        super.delete();
    }
}

class TrashContentProvider extends ContentProvider {
    /**
     * @param repository {Repository}
     */
    constructor(repository) {
        super();
        this.repository = repository;
    }

    async get_content() {
        const items = [];
        for (const item_id of await this.repository.content.trash_content()) {
            const item = await this.repository.content.fetch_item(item_id);
            items.push(item);
        }
        return items;
    }

    async _internal_add_item(item) {
        await super._internal_add_item(item);
        if (item.in_trash && item.repository === this.repository.id) {
            if (!item.parent_item || !(await item.filesystem().fetch_item(item.parent_item)).in_trash)
                this.events.broadcast('add', item);
        }
    }

    delete() {
        super.delete();
    }
}

export {DirectoryContentProvider, RepositoryRootProvider, TrashContentProvider}