import {ContentProvider} from "./viewport_content";
import {ContentRequest} from "../remote_filesystem/content_request";

class RepositoryRootProvider extends ContentProvider {
    /**
     * @param repository {Repository}
     */
    constructor(repository) {
        super(repository.get_pool());
        console.assert(repository, "Cannot create a RepositoryRootProvider with a null repository");
        this.repository = repository;
    }

    async get_content() {
        const items = [];
        const children = await this.repository.children();
        await this.repository.get_pool().fetch_content(new ContentRequest().item(Array.from(children)))
        for (const item_id of children) {
            const item = await this.repository.get_pool().find_item(item_id);
            if (!item.in_trash)
                items.push(item);
        }
        return items;
    }

    async _internal_add_item(item) {
        if (!item.in_trash && item.parent_item === undefined && item.repository === this.repository.id)
            await this.events.broadcast('add', item);
    }

    is_same(other) {
        return super.is_same(other) && this.repository.id === other.repository.id;
    }
}

class DirectoryContentProvider extends ContentProvider {
    /**
     * @param directory {RemoteItem}
     */
    constructor(directory) {
        super(directory.get_pool());
        console.assert(directory, "Cannot create a DirectoryContentProvider with a null directory");
        if (directory.is_regular_file)
            console.error("Cannot open a file as a directory");
        /**
         * @type {RemoteItem}
         */
        this.directory = directory;
    }

    is_same(other) {
        return super.is_same(other) && this.directory.id === other.directory.id;
    }

    async get_content() {
        const items = [];

        const directory_content = await this.directory.children();
        await this.directory.get_pool().fetch_content(new ContentRequest().item(Array.from(directory_content)))
        for (const item_id of directory_content) {
            const item = await this.directory.get_pool().find_item(item_id);
            if (!item.in_trash)
                items.push(item);
        }
        return items;
    }

    async _internal_add_item(item) {
        await super._internal_add_item(item);
        if (!item.in_trash && item.parent_item === this.directory.id)
            await this.events.broadcast('add', item);
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
        super(repository.get_pool());
        console.assert(repository, "Cannot create a TrashContentProvider with a null repository");
        this.repository = repository;
    }

    async get_content() {
        const items = [];
        await this.repository.get_pool().fetch_content(new ContentRequest().trash_root([this.repository.id]));
        if (this.repository.trash)
            for (const item_id of this.repository.trash)
                items.push(await this.repository.get_pool().fetch_item(item_id));
        return items;
    }

    is_same(other) {
        return super.is_same(other) && this.repository.id === other.repository.id;
    }

    async _internal_add_item(item) {
        await super._internal_add_item(item);
        if (item.in_trash && item.repository === this.repository.id) {
            if (!item.parent_item || !(await item.get_pool().fetch_item(item.parent_item)).in_trash)
                await this.events.broadcast('add', item);
        }
    }

    delete() {
        super.delete();
    }
}

class FilterContentProvider extends ContentProvider {
    /**
     * @param pool {ContentPool}
     * @param filter {Filter}
     */
    constructor(pool, filter) {
        super(pool);
        this.pool = pool;
        this.filter = filter;
    }

    /**
     * @returns {Promise<RemoteItem[]>}
     */
    async get_content() {
        if (!this._cache) {
            this._cache = new Promise(async resolve => {
                const cache = [];
                const items = await this.pool.fetch_filtered(this.filter);
                await this.pool.fetch_content(new ContentRequest().item(items));
                for (const item of items)
                    cache.push(this.pool.find_item(item));
                resolve(cache);
            });
        }
        return this._cache;
    }

    is_same(other) {
        return super.is_same(other) &&
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