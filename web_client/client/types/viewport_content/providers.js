import {ContentProvider} from "./viewport_content";

class RepositoryRootProvider extends ContentProvider {
    /**
     * @param repository {Repository}
     */
    constructor(repository) {
        super();
        console.assert(repository, "Cannot create a RepositoryRootProvider with a null repository");
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

    is_same(other) {
        return super.is_same(other) && this.repository.id === other.repository.id;
    }
}

class DirectoryContentProvider extends ContentProvider {
    /**
     * @param directory {FilesystemItem}
     */
    constructor(directory) {
        super();
        console.assert(directory, "Cannot create a DirectoryContentProvider with a null directory");
        if (directory.is_regular_file)
            console.error("Cannot open a file as a directory");
        /**
         * @type {FilesystemItem}
         */
        this.directory = directory;
    }

    is_same(other) {
        return super.is_same(other) && this.directory.id === other.directory.id;
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
        console.assert(repository, "Cannot create a TrashContentProvider with a null repository");
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

    is_same(other) {
        return super.is_same(other) && this.repository.id === other.repository.id;
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

class FilterContentProvider extends ContentProvider {
    /**
     * @param repository {Repository}
     * @param directory {FilesystemItem}
     * @param filter {Filter}
     */
    constructor(repository, directory, filter) {
        super();
        this.repository = repository;
        this.directory = directory;
        this.filter = filter;
    }

    async get_content() {
        if (!this._cache) {
            this._cache = [];
            const items = await this.repository.content.fetch_filtered(this.filter, this.directory);
            for (const item of items)
                this._cache.push(item);
        }
        return this._cache;
    }

    is_same(other) {
        return super.is_same(other) &&
            this.repository.id === other.directory.id &&
            ((!this.directory && !other.directory) || (this.directory && other.directory && this.directory.id === other.directory.id)) &&
            this.filter.equals(other.filter);
    }

    async _internal_add_item(item) {
        await super._internal_add_item(item);
        if (this.filter.test(item))
            await this.events.broadcast('add', item);
    }

    delete() {
        super.delete();
    }
}

export {DirectoryContentProvider, RepositoryRootProvider, TrashContentProvider, FilterContentProvider}