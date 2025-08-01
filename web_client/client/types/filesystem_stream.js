const {EncString} = require("./encstring");
const {GLOBAL_EVENTS} = require("./event_manager");
const {NOTIFICATION, Message} = require("../modules/index/tools/message_box/notification");

/**
 * @type {Map<number, FilesystemStream>}
 * @private
 */
const _LOCAL_STORAGE = new Map();

class FilesystemItem {
    constructor(data) {
        /**
         * @type {number}
         */
        this.id = data.id;

        /**
         * @type {number}
         */
        this.repository = data.repository;

        /**
         * @type {number}
         */
        this.owner = data.owner;

        /**
         * @type {EncString}
         */
        this.name = new EncString(data.name);

        /**
         * @type {boolean}
         */
        this.is_regular_file = data.is_regular_file;

        /**
         * @type {EncString}
         */
        this.description = new EncString(data.description);

        /**
         * @type {number|null}
         */
        this.parent_item = data.parent_item;

        /**
         * @type {EncString}
         */
        this.absolute_path = new EncString(data.absolute_path);

        /**
         * @type {boolean}
         */
        this.in_trash = data.in_trash;

        if (this.is_regular_file) {
            /**
             * @type EncString
             */
            this.mimetype = new EncString(data.mimetype);
            /**
             * @type number
             */
            this.size = data.size;
            /**
             * @type number
             */
            this.timestamp = data.timestamp;

            /**
             * @type number
             */
            this.num_items = 1;

            /**
             * @type number
             */
            this.content_size = data.size;
        } else {
            /**
             * @type boolean
             */
            this.open_upload = data.open_upload;

            /**
             * @type number
             */
            this.num_items = data.num_items;

            /**
             * @type number
             */
            this.content_size = data.content_size;
        }


        /**
         * @type {null|Set<number>}
         */
        this.children = null;
    }

    static async new(data) {
        const item = new FilesystemItem(data);
        const filesystem = _LOCAL_STORAGE.get(item.repository)
        if (filesystem) {
            await filesystem.set_or_update_item(item);
        }
        return item;
    }

    /**
     * @return {FilesystemItem}
     */
    display_data() {
        const result = JSON.parse(JSON.stringify(this));
        result.name = this.name.plain()
        result.description = this.description ? this.description.plain() : '';
        result.absolute_path = this.absolute_path.plain()
        if (this.mimetype)
            result.mimetype = this.mimetype.plain()
        return result
    }

    /**
     * @param item_id {number}
     * @return {Promise<boolean>}
     */
    async is_in_parents(item_id) {
        if (item_id === this.parent_item)
            return true;
        if (this.parent_item)
            return await (await this.filesystem().fetch_item(this.parent_item)).is_in_parents(item_id);
        return false;
    }

    async refresh() {
        const storage = this.filesystem();
        if (storage)
            await storage.set_or_update_item(this);
    }

    /**
     * @return {FilesystemStream|null}
     */
    filesystem() {
        return _LOCAL_STORAGE.get(this.repository);
    }

    async remove() {
        const fs = this.filesystem();
        await fs.remove_item(this);
    }

    /**
     * @param app {FileshareApp}
     * @returns {Promise<string>}
     */
    async url(app) {
        const {Repository} = require("./repository");
        const repository = await Repository.find(app, this.repository);
        const base = await repository.url(app);
        return `${base}/tree${this.absolute_path.plain()}`
    }

    /**
     * @return {Promise<void>}
     */
    async download() {
        window.open(`/api/item/get/${this.id}`);
    }

    /**
     * @param ids {number[]}
     * @return {Promise<void>}
     */
    static async downloads(ids) {
        let str = '';
        for (const id of ids)
            str += `${id}-`;
        window.open(`/api/item/download/${str}`);
    }
}

class FilesystemStream {

    /**
     * @param app {FileshareApp}
     * @param repository {Repository}
     */
    constructor(app, repository) {
        /**
         * @type {Repository}
         * @private
         */
        this._repository = repository;

        _LOCAL_STORAGE.set(this._repository.id, this);

        this.app = app;

        /**
         * @type {Map<number, FilesystemItem>}
         * @private
         */
        this._items = new Map();

        /**
         * @type {Set<number>}
         * @private
         */
        this._roots = null;

        /**
         * @type {Set<number>}
         * @private
         */
        this._trash_roots = null;
    }

    /**
     * @param item_id {number | number[]}
     * @param force_update
     * @returns {Promise<FilesystemItem | FilesystemItem[]>}
     */
    async fetch_item(item_id, force_update = true) {
        if (item_id === undefined)
            return console.error("Undefined item id")
        if (item_id === null)
            return null;

        const is_array = item_id.constructor.name === 'Array';
        const ids = is_array ? item_id : [item_id];

        const found = [];
        const not_found = [];
        for (const id of ids) {
            console.assert(id, "Invalid item ID !");
            const local = this.find(id);
            if (local)
                found.push(local);
            else
                not_found.push(id);
        }
        if (not_found.length !== 0) {
            let items = await this.app.fetch_api('item/find', 'POST', not_found)
                .catch(error => {
                    NOTIFICATION.warn(new Message(`Impossible de récupérer les objets ${not_found} : ${error.message}`))
                    throw error;
                });
            for (const item of items) {
                const new_item = new FilesystemItem(item);
                if (force_update)
                    await this.set_or_update_item(new_item);
                else if (!this.find(new_item.id))
                    await this.set_or_update_item(new_item);
                found.push(new_item);

            }
        }

        return is_array ? found : found.length > 0 ? found[0] : null;
    }

    /**
     * @param item_id {number}
     * @return {FilesystemItem}
     */
    find(item_id) {
        return this._items.get(item_id);
    }

    /**
     * @param item_ids {number[]}
     * @return {Promise<Set<number>>}
     */
    async directory_content(item_ids) {

        let items = new Map();

        let mutualise_fetch_promise = new Promise(async resolve => {

            for (const item of item_ids) {
                const existing = await this.fetch_item(item);
                if (!existing)
                    continue;

                // The content is already in a generation process for this item
                if (existing._get_directory_content_promise) {
                    items.set(item, await existing._get_directory_content_promise)
                }
                // We need to fetch the content of this one
                else {
                    existing.children = new Set();
                    existing._get_directory_content_promise = new Promise(async resolve => {
                        await mutualise_fetch_promise;
                        resolve(existing.children);
                    })
                    items.set(item, null)
                }
            }

            let items_to_fetch = [];
            for (const [item, content] of items)
                if (!content)
                    items_to_fetch.push(item);

            if (items_to_fetch.length !== 0) {
                let fetched_content = await this.app.fetch_api(`item/directory-content`, 'POST', items_to_fetch)
                    .catch(error => {
                        NOTIFICATION.warn(new Message(error).title(`Impossible de lire le contenu de ${items_to_fetch}`))
                        resolve(new Set())
                    });

                for (const item of fetched_content) {
                    const parent = await this.find(item.parent_item);
                    if (await this.find(item.id))
                        parent.children.add(item.id);
                    else
                        await this.set_or_update_item(new FilesystemItem(item));
                }
            }

            for (const item of items_to_fetch)
                items.set(item, this.find(item).children)

            let result = new Set();
            for (const content of items.values())
                for (const item of content)
                    result.add(item)


            resolve(result);
        });

        return await mutualise_fetch_promise;
    }

    /**
     * @param item_id {number[]}
     * @return {Promise<>}
     */
    async preload_to(item_id) {
        const items = await this.app.fetch_api(`item/content-to`, 'POST', item_id)
            .catch(error => {
                NOTIFICATION.warn(new Message(error).title(`Impossible de lire le contenu de ${item_id}`))
                return [];
            });
        /**
         * @type {Map<number, FilesystemItem>}
         */
        const indexed_items = new Map();
        for (const item of items)
            indexed_items.set(item.id, new FilesystemItem(item));

        if (!this._roots)
            this._roots = new Set();

        const try_register_item = (item_id) => {
            const existing = this.find(item_id);
            if (existing)
                return existing;
            const data = indexed_items.get(item_id);
            if (data.parent_item) {
                let parent = this.find(data.parent_item);
                if (!parent)
                    parent = try_register_item(data.parent_item);
                if (!parent.children)
                    parent.children = new Set();
                parent.children.add(item_id);
            }
            this._register_item(data);
            return data;
        }
        for (const item of items)
            try_register_item(item.id);
    }

    /**
     * @param app {FileshareApp}
     * @param repositories {number[]}
     * @return {Promise<Set<number>>}
     */
    static async root_content(app, repositories) {

        const {Repository} = require("./repository");

        let output_roots = new Map();

        let cb_get_all_roots = new Promise(async resolve => {
            let repository_to_fetch = [];
            for (const repository_id of repositories) {
                const repository = await Repository.find(app, repository_id);
                if (repository.content._init_get_roots)
                    output_roots.set(repository_id, await repository.content._init_get_roots);
                else {
                    repository.content._roots = new Set();
                    repository.content._init_get_roots = new Promise(async resolve => {
                        await cb_get_all_roots;
                        resolve(repository.content._roots);
                    });
                    repository_to_fetch.push(repository_id);
                    output_roots.set(repository_id, repository.content._roots);
                }
            }

            if (repository_to_fetch.length !== 0) {
                let retrieved_root_contents = await app.fetch_api(`repository/root-content`, 'POST', repository_to_fetch)
                    .catch(error => {
                        NOTIFICATION.warn(new Message(error).title(`Impossible de lire la racine de ${repository_to_fetch}`));
                        resolve();
                    });

                for (const item of retrieved_root_contents) {
                    const repository = await Repository.find(app, item.repository);
                    if (repository.content._items.has(item.id))
                        repository.content._roots.add(item.id);
                    else
                        await repository.content.set_or_update_item(new FilesystemItem(item));
                }
            }
            resolve();
        });
        await cb_get_all_roots;
        let result = new Set();
        for (const [_, content] of output_roots) {
            for (const item_id of content)
                result.add(item_id);
        }
        return result;
    }

    /**
     * @param filter {Filter}
     * @param directory {FilesystemItem}
     * @returns {Promise<FilesystemItem[]>}
     */
    async fetch_filtered(filter, directory) {
        const data = filter.data();
        data.repositories = [
            {
                repository: this._repository.id.toString(),
                root_items: directory ? [directory.id] : []
            }
        ]
        const item_ids = await this.app.fetch_api(`item/search`, 'POST', data).catch(error => {
            NOTIFICATION.warn(new Message(error).title(`Impossible de chercher des éléments dan sle dépot ${this._repository.url_name.plain()}`));
            return [];
        });
        return await this.fetch_item(item_ids, false);
    }

    /**
     * @param app {FileshareApp}
     * @param repositories {number[]}
     * @return {Promise<Set<number>>}
     */
    static async trash_content(app, repositories) {

        const {Repository} = require("./repository");

        let output_trashes = new Map();

        let cb_get_all_trashes = new Promise(async resolve => {
            let repository_to_fetch = [];
            for (const repository_id of repositories) {
                const repository = await Repository.find(app, repository_id);
                if (repository.content._init_trash_roots)
                    output_trashes.set(repository_id, await repository.content._init_trash_roots);
                else {
                    repository.content._trash_roots = new Set();
                    repository.content._init_trash_roots = new Promise(async resolve => {
                        await cb_get_all_trashes;
                        resolve(repository.content._trash_roots);
                    });
                    repository_to_fetch.push(repository_id);
                    output_trashes.set(repository_id, repository.content._trash_roots);
                }
            }

            if (repository_to_fetch.length !== 0) {
                let retrieved_trash_contents = await app.fetch_api(`repository/trash-content`, 'POST', repository_to_fetch)
                    .catch(error => {
                        NOTIFICATION.warn(new Message(error).title(`Impossible de lire le contenu de la corbeille de ${repository_to_fetch}`));
                        resolve();
                    });

                for (const item of retrieved_trash_contents) {
                    const repository = await Repository.find(app, item.repository);
                    if (repository.content._items.has(item.id))
                        repository.content._trash_roots.add(item.id);
                    else
                        await repository.content.set_or_update_item(new FilesystemItem(item));
                }
            }
            resolve();
        });

        await cb_get_all_trashes;

        let result = new Set();
        for (const [_, content] of output_trashes) {
            for (const item_id of content)
                result.add(item_id);
        }
        return result;
    }

    /**
     * @param item {FilesystemItem}
     */
    async set_or_update_item(item) {
        if (this._items.has(item.id)) {
            await this.remove_item(item);
        }
        if (item.parent_item !== undefined) {
            if (!this.find(item.parent_item)) {
                await this.preload_to([item.id]);
            }
            // Fetch parents and parent's children
            const parent = await this.fetch_item(item.parent_item);
            if (!parent.children)
                await parent.filesystem().directory_content([parent.id]);
        }
        this._register_item(item);
    }

    /**
     * @param item
     * @private
     */
    _register_item(item) {
        this._items.set(item.id, item);
        if (item.parent_item !== undefined) {
            const parent = this.find(item.parent_item);
            if (!parent)
                console.error("Parent have not been preloaded")
            if (item.in_trash && !parent.in_trash && this._trash_roots)
                this._trash_roots.add(item.id);
            if (!parent.children)
                console.error("Children have not been preloaded");
            else
                parent.children.add(item.id);
        } else {
            if (item.in_trash) {
                if (this._trash_roots)
                    this._trash_roots.add(item.id);
            }
            if (this._roots)
                this._roots.add(item.id);
        }
        GLOBAL_EVENTS.broadcast('add_item', item);
    }


    /**
     * @param item {FilesystemItem}
     * @return {Promise<void>}
     */
    async remove_item(item) {
        if (this._trash_roots)
            this._trash_roots.delete(item.id);
        if (item.parent_item) {
            const parent = await this.fetch_item(item.parent_item);
            if (parent.children)
                parent.children.delete(item.id);
        } else if (this._roots) {
            this._roots.delete(item.id);
        }
        await GLOBAL_EVENTS.broadcast('remove_item', item);
    }

    /**
     * @param child_name {string}
     * @param parent_item {FilesystemItem|null}
     * @return {Promise<*|null>}
     */
    async find_child(child_name, parent_item) {
        const children = parent_item ? await this.directory_content([parent_item.id]) : await FilesystemStream.root_content(this.app, [this._repository.id]);
        for (const child of children) {
            const child_data = this.find(child);
            if (child_data.name.plain() === child_name)
                return child_data;
        }
        return null;
    }

    /**
     * @param id {number}
     * @return {FilesystemStream}
     */
    static find(id) {
        return _LOCAL_STORAGE.get(id)
    }
}


module.exports = {FilesystemStream, FilesystemItem}