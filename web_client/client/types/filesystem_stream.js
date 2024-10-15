const {EncString} = require("./encstring");
const {User} = require("./user");
const {fetch_api} = require("../utilities/request");
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
     * @return {Promise<void>}
     */
    async download() {
        window.open(`/api/item/get/${this.id}/`);
    }

    /**
     * @param ids {number[]}
     * @return {Promise<void>}
     */
    static async downloads(ids) {
        let str = '';
        for (const id of ids)
            str += `${id}-`;
        window.open(`/api/item/download/${str}/`);
    }
}

class FilesystemStream {

    /**
     * @param repository {Repository}
     */
    constructor(repository) {
        /**
         * @type {Repository}
         * @private
         */
        this._repository = repository;

        _LOCAL_STORAGE.set(this._repository.id, this);

        /**
         * @type {Promise<User>}
         * @private
         */
        this._user = new Promise(async (ok) => {
            ok(await User.find(this._repository.id));
        });

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
     * @param item_id {number}
     * @returns {Promise<FilesystemItem>}
     */
    async fetch_item(item_id) {
        if (item_id === null)
            return null;
        const existing = this._items.get(item_id);
        if (existing) {
            return existing;
        }
        for (const item of await fetch_api(`item/find/`, 'POST', [item_id])
            .catch(error => {
                NOTIFICATION.warn(new Message(error).title(`L'object ${item_id} n'existe pas`));
                return [];
            })) {
            await this.set_or_update_item(new FilesystemItem(item));
        }
        return this._items.get(item_id);
    }

    /**
     * @param item_id {number}
     * @return {FilesystemItem}
     */
    find(item_id) {
        return this._items.get(item_id);
    }

    /**
     * @param item_id {number}
     * @return {Promise<Set<number>>}
     */
    async directory_content(item_id) {
        const existing = await this.fetch_item(item_id);
        if (!existing)
            return new Set();
        if (existing.children) {
            return existing.children;
        }
        existing.children = new Set();
        for (const item of await fetch_api(`item/directory-content/`, 'POST', [item_id])
            .catch(error => {
                NOTIFICATION.warn(new Message(error).title(`Impossible de lire le contenu de l'objet ${item_id}`))
                return [];
            })) {
            await this.set_or_update_item(new FilesystemItem(item));
        }
        return existing.children;
    }

    /**
     * @return {Promise<Set<number>>}
     */
    async root_content() {
        if (!this._roots) {
            this._roots = new Set();
            for (const item of await fetch_api(`repository/root-content/`, 'POST', [this._repository.id])
                .catch(error => {
                    NOTIFICATION.warn(new Message(error).title(`Impossible de lire la racion du dépot ${this._repository.url_name.plain()}`));
                    return [];
                })) {
                await this.set_or_update_item(new FilesystemItem(item));
            }
        }
        return this._roots
    }

    /**
     * @return {Promise<Set<number>>}
     */
    async trash_content() {
        if (!this._trash_roots) {
            this._trash_roots = new Set();
            for (const item of await fetch_api(`repository/trash-content/`, 'POST', [this._repository.id])
                .catch(error => {
                    NOTIFICATION.warn(new Message(error).title(`Impossible de lire le contenu de la corbeille de ${this._repository.url_name.plain()}`));
                    return [];
                })) {
                await this.set_or_update_item(new FilesystemItem(item));
            }
        }
        return this._trash_roots
    }

    /**
     * @param item {FilesystemItem}
     */
    async set_or_update_item(item) {
        if (this._items.has(item.id)) {
            await this.remove_item(item);
        }
        this._items.set(item.id, item);
        if (item.parent_item !== undefined) {
            const parent = await this.fetch_item(item.parent_item);
            if (item.in_trash && !parent.in_trash && this._trash_roots)
                this._trash_roots.add(item.id);
            if (!parent.children)
                await parent.filesystem().directory_content(parent.id);
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
        GLOBAL_EVENTS.broadcast('remove_item', item);
    }

    /**
     *
     * @param child_name {string}
     * @param parent_item {FilesystemItem|null}
     * @return {Promise<*|null>}
     */
    async find_child(child_name, parent_item) {
        const children = parent_item ? await this.directory_content(parent_item.id) : await this.root_content();
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