import {ContentRequest} from "./content_request";

const {EncString} = require("../encstring");

class RemoteItem {
    constructor(data) {
        /**
         * @type {ContentPool}
         */
        this._pool = null;

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
        this._children = null;
    }

    /**
     * @return {RemoteItem}
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
     * @returns {Promise<Set<number>>}
     */
    async children() {
        if (!this._children)
            await this.pool().fetch_content(new ContentRequest().directory_content([this.id]));
        return this._children || new Set();
    }

    /**
     * @param name {String}
     * @returns {RemoteItem|null}
     */
    async find_child(name) {
        for (const child of await this.children()) {
            const item = await this.pool().fetch_item(child);
            if (item.name.plain() === name)
                return item;
        }

        return null;
    }

    /**
     * @param item_id {number}
     * @return {Promise<boolean>}
     */
    async is_in_parents(item_id) {
        if (item_id === this.parent_item)
            return true;
        if (this.parent_item)
            return await (await this.pool().fetch_item(this.parent_item)).is_in_parents(item_id);
        return false;
    }

    async refresh() {
        await this.pool().refresh_item(this);
    }

    /**
     * @return {ContentPool}
     */
    pool() {
        console.assert(this._pool, `Content pool have not been initialized for item, ${this.absolute_path.plain()}`)
        return this._pool;
    }

    async remove() {
        await this.pool().remove_item(this.id);
    }

    /**
     * @param app {FileshareApp}
     * @returns {Promise<string>}
     */
    async url(app) {
        const repository = await this.pool().fetch_repository(this.repository);
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

export {RemoteItem}