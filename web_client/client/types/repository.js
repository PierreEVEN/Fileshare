import {EncString} from "./encstring";
import {APP_COOKIES} from "../modules/index/tools/cookies/cookies";
import {ContentRequest} from "./remote_filesystem/content_request";

class RepositoryStatus {
    constructor(data) {
        this._role = '';
        switch (data) {
            case "Private":
            case "Hidden":
            case "Public":
                /**
                 * @type{string}
                 * @private
                 */
                this._role = data.toString();
                break;
        }
    }

    toString() {
        return this._role;
    }
}


class Repository {
    constructor(data) {
        /**
         * @type {ContentPool}
         */
        this._pool = null;

        /**
         * @type {Set<number>}
         */
        this._children = null;

        /**
         * @type {Set<number>}
         */
        this.trash = null;

        /**
         * @type {number}
         */
        this.id = data.id;
        /**
         * @type {EncString}
         */
        this.url_name = new EncString(data.url_name);
        /**
         * @type {number}
         */
        this.owner = data.owner
        /**
         * @type {EncString}
         */
        this.description = new EncString(data.description);
        /**
         * @type {RepositoryStatus}
         */
        this.status = new RepositoryStatus(data.status);
        /**
         * @type {EncString}
         */
        this.display_name = new EncString(data.display_name);
        /**
         * @type {number}
         */
        this.max_file_size = data.max_file_size;
        /**
         * @type {number}
         */
        this.visitor_file_lifetime = data.visitor_file_lifetime;
        /**
         * @type {number}
         */
        this.allow_visitor_upload = data.allow_visitor_upload;

        APP_COOKIES.push_last_repositories(data.id);
    }

    /**
     * @returns {ContentPool}
     */
    get_pool() {
        console.assert(this._pool, `Content pool have not been initialized for repository, ${this.display_name.plain()}`)
        return this._pool;
    }

    /**
     * @returns {Promise<Set<number>>}
     */
    async children() {
        if (!this._children)
            await this.get_pool().fetch_content(new ContentRequest().repository_root([this.id]));
        return this._children || new Set();
    }

    /**
     * @param name {String}
     * @returns {RemoteItem|null}
     */
    async find_child(name) {
        for (const child of await this.children()) {
            const item = await this.get_pool().fetch_item(child);
            if (item.name.plain() === name)
                return item;
        }

        return null;
    }

    /**
     * @return {void}
     */
    download() {
        window.open(`/api/repository/download/${this.id}`);
    }

    async refresh() {
        await this.get_pool().refresh_repository(this);
    }

    /**
     * @return {Repository}
     */
    display_data() {
        const result = JSON.parse(JSON.stringify(this));
        result.url_name = this.url_name.plain()
        result.description = this.description.plain()
        result.display_name = this.display_name.plain()
        return result
    }

    /**
     * @return {Promise<String>}
     */
    async url() {
        return `${this.get_pool().get_app().origin()}/${(await this.get_pool().fetch_user(this.owner)).name.plain()}/${this.url_name.plain()}`
    }

    /**
     * @return {Promise<String>}
     */
    async trash_url() {
        return `${this.get_pool().get_app().origin()}/${(await this.get_pool().fetch_user(this.owner)).name.plain()}/${this.url_name.plain()}/trash`
    }

    async remove() {
        await this._pool.remove_repository(this.id);
    }

    toJSON() {
        const data = {};
        for (const [key, value] of Object.entries(this)) {
            if (key !== 'content')
                data[key] = value;
        }
        return data;
    }
}

export {Repository, RepositoryStatus}