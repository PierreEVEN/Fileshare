import {Repository} from "./repository";
import {EventManager} from "../event_manager";
import {User} from "./user";
import {RemoteItem} from "./remote_item";
import {Message, NOTIFICATION} from "../../widgets/misc/message_box/notification";
import {ContentRequest} from "./content_request";
import {Permission} from "../utilities/permissions";

class ContentPool {
    /**
     * @param app {FileshareApp}
     */
    constructor(app) {
        /**
         * @type {FileshareApp}
         * @private
         */
        this._app = app;

        /**
         * @type {EventManager}
         */
        this.events = new EventManager();

        /**
         * @type {Map<number, Repository>}
         * @private
         */
        this._repositories = new Map();

        /**
         * @type {Map<number, User>}
         * @private
         */
        this._users = new Map();

        /**
         * @type {Map<number, RemoteItem>}
         * @private
         */
        this._items = new Map();

        /**
         * @type {Map<number, Permission>}
         * @private
         */
        this._item_permissions = new Map();

        /**
         * @type {Map<number, Permission>}
         * @private
         */
        this._repository_permissions = new Map();

        /**
         * @type {ContentRequest}
         * @private
         */
        this._request_in_queue = null;

        /**
         * @type {ContentRequest}
         * @private
         */
        this._running_request = null;

        /**
         * @type {function}
         * @private
         */
        this._resolve_running_request = null;

        /**
         * @type {Promise<unknown>}
         * @private
         */
        this._next_request_promise = new Promise((resolve) => this._resolve_running_request = resolve);
    }

    /**
     * @param request {ContentRequest}
     * @returns {Promise<void>}
     */
    async fetch_content(request) {
        if (!request.make_body(this))
            return;

        if (this._request_in_queue)
            this._request_in_queue.merge(request);
        else
            this._request_in_queue = request;

        if (this._running_request)
            await this._next_request_promise
        this._try_execute_pending_request();
        await this._next_request_promise;
    }

    _try_execute_pending_request() {
        if (!this._request_in_queue || this._running_request)
            return;

        this._running_request = this._request_in_queue;
        this._request_in_queue = null;

        const body = this._running_request.make_body(this);
        if (!body) {
            setTimeout(() => {
                this._resolve_running_request(this._running_request.indices);
                delete this._running_request;
                this._next_request_promise = new Promise((resolve) => this._resolve_running_request = resolve);
                this._try_execute_pending_request();
            }, 1)
            return;
        }

        this.get_app().fetch_api('repository/fetch', 'POST', body)
            .then(async request_result => {
                if (typeof(request_result) === "string") {
                    console.error("Failed to fetch content :", request_result);
                    return;
                }

                if (request_result.repositories)
                    for (const repository of request_result.repositories)
                        await this._register_repository(repository);

                if (request_result.users)
                    for (const user of request_result.users)
                    await this._register_user(user);

                if (request_result.items)
                    for (const item of request_result.items)
                        await this._register_item(item);

                if (request_result.repository_roots)
                    for (const data of request_result.repository_roots) {
                        const repository = this.find_repository(data.repository);
                        console.assert(repository, `Fetched root content of repository ${data.repository} but base repository does not exists`)
                        repository._children = new Set(data.content);
                    }

                if (request_result.trash_roots)
                    for (const data of request_result.trash_roots) {
                        const repository = this.find_repository(data.repository);
                        console.assert(repository, `Fetched trash content of repository ${data.repository} but base repository does not exists`)
                        repository.trash = new Set(data.content);
                    }

                if (request_result.directory_content)
                    for (const data of request_result.directory_content) {
                        const directory = this.find_item(data.directory);
                        console.assert(directory, `Fetched content of directory ${data.directory} but base directory does not exists`)
                        directory._children = new Set(data.content);
                    }

                if (request_result.item_permissions)
                    for (const data of request_result.item_permissions)
                        this._item_permissions.set(data.item, new Permission(data.perm));

                if (request_result.repository_permissions)
                    for (const data of request_result.repository_permissions)
                        this._repository_permissions.set(data.repository, new Permission(data.perm));

            }).catch(error => {
                console.error("Failed to fetch content :", error);
            })
            .finally(() => {
                this._resolve_running_request(this._running_request.indices);
                delete this._running_request;
                this._next_request_promise = new Promise((resolve) => this._resolve_running_request = resolve);
                this._try_execute_pending_request();
            });
    }

    async _register_repository(data) {
        const existing = this.find_repository(data.id);
        if (!existing) {
            const repository = new Repository(data);
            repository._pool = this;
            this._repositories.set(data.id, repository);
            await this.events.broadcast('add_repository', repository);
            return repository;
        }
        return existing;
    }

    async _register_user(data) {
        const existing = this.find_user(data.id);
        if (!existing) {
            const user = new User(data);
            user._pool = this;
            this._users.set(data.id, user);
            await this.events.broadcast('add_user', user);
            return user;
        }
        return existing;
    }

    /**
     * @param data {Object}
     * @return {Promise<RemoteItem>}
     * @private
     */
    async _register_item(data) {
        const existing = this.find_item(data.id);
        if (!existing) {
            const item = new RemoteItem(data);
            item._pool = this;
            this._items.set(data.id, item);
            if (item.parent_item) {
                const parent = this.find_item(item.parent_item);
                if (parent && parent._children)
                    parent._children.add(item.id);
            } else {
                const repository = this.find_repository(item.repository);
                if (repository._children)
                    repository._children.add(item.id);
            }
            await this.events.broadcast('add_item', item);
            return item;
        }
        return existing;
    }

    /**
     * @param id {number}
     * @return {Promise<void>}
     */
    async remove_item(id) {
        const item = this.find_item(id);
        if (!item)
            return;

        const repository = this.find_repository(item.repository);
        console.assert(repository, `Cannot remove item ${item.name.plain()} as it's parent repository does not exists`);

        if (repository._children)
            repository._children.delete(item.id);
        if (repository.trash)
            repository.trash.delete(item.id);

        if (item._children)
            for (const child_id of item._children)
                await this.remove_item(child_id);

        if (item.parent_item) {
            const parent = this.find_item(item.parent_item);
            if (parent && parent._children)
                parent._children.delete(item.id);
        }
        this._items.delete(item.id);

        await this.events.broadcast('remove_item', item);
    }

    /**
     * @param id {number}
     * @return {Promise<void>}
     */
    async remove_repository(id) {
        const data = this.find_repository(id);
        if (!data)
            return;
        this._repositories.delete(id);
        await this.events.broadcast('remove_repository', data);
    }

    /**
     * @param id {number}
     * @returns {Repository}
     */
    find_repository(id) {
        return this._repositories.get(id);
    }

    /**
     * @param id {number}
     * @returns {Promise<Repository>}
     */
    async fetch_repository(id) {
        const existing = this.find_repository(id);
        if (existing)
            return existing;
        await this.fetch_content(new ContentRequest().repository([id]));
        return this.find_repository(id);
    }

    /**
     * @param id {number}
     * @returns {RemoteItem}
     */
    find_item(id) {
        return this._items.get(id);
    }

    /**
     * @param id {number}
     * @param include_parents
     * @returns {Promise<RemoteItem>}
     */
    async fetch_item(id, include_parents = false) {
        const existing = this.find_item(id);
        if (existing) {
            if (!include_parents || this.has_hierarchy_to(id))
                return existing;
        }
        await this.fetch_content(new ContentRequest().item([id], include_parents));
        return this.find_item(id);
    }

    /**
     * @param id {number}
     * @returns {User}
     */
    find_user(id) {
        return this._users.get(id);
    }

    /**
     * @param id {number}
     * @returns {Promise<User>}
     */
    async fetch_user(id) {
        const existing = this.find_user(id);
        if (existing)
            return existing;
        await this.fetch_content(new ContentRequest().user([id]));
        return this.find_user(id);
    }

    /**
     * @param id {number}
     * @return boolean
     */
    has_hierarchy_to(id) {
        const item = this.find_item(id);
        if (!item)
            return false;
        if (!item.parent_item)
            return true;
        return this.has_hierarchy_to(item.parent_item);
    }

    /**
     * @returns {FileshareApp}
     */
    get_app() {
        return this._app;
    }

    /**
     * @param filter {Filter}
     * @returns {Promise<number[]>}
     */
    async fetch_filtered(filter) {
        const data = filter.data();
        return await this.get_app().fetch_api(`item/search`, 'POST', data).catch(error => {
            NOTIFICATION.warn(new Message(error).title(`Impossible d'executer la recherche !' ${JSON.stringify(data)}`));
            return [];
        });
    }

    /**
     * @param item {RemoteItem}
     * @returns {Promise<void>}
     */
    async refresh_item(item) {
        await this.events.broadcast('remove_item', item);
        await this.events.broadcast('add_item', item);
    }

    /**
     * @param repository {Repository}
     * @returns {Promise<void>}
     */
    async refresh_repository(repository) {
        await this.events.broadcast('remove_repository', repository);
        await this.events.broadcast('add_repository', repository);
    }

    /**
     * @return {Promise<{owned: number[], shared: number[]}>}
     */
    async available_repositories() {
        return await this.get_app().fetch_api('repository/available')
            .catch(error => {
                NOTIFICATION.error(new Message(error).title(`Impossible de télécharger la liste des dépôts possédés`));
                return [];
            });
    }

    /**
     * @param id {number}
     * @returns {Permission}
     */
    find_item_permissions(id) {
        return this._item_permissions.get(id);
    }

    /**
     * @param id {number}
     * @returns {Promise<Permission>}
     */
    async fetch_item_permissions(id) {
        const existing = this._item_permissions.get(id);
        if (existing)
            return existing;
        await this.fetch_content(new ContentRequest().item_permissions([id]));
        return this._item_permissions.get(id);
    }

    /**
     * @param id {number}
     * @returns {Permission}
     */
    find_repository_permissions(id) {
        return this._repository_permissions.get(id);
    }

    /**
     * @param id {number}
     * @returns {Promise<Permission>}
     */
    async fetch_repository_permissions(id) {
        const existing = this._repository_permissions.get(id);
        if (existing)
            return existing;
        await this.fetch_content(new ContentRequest().repository_permissions([id]));
        return this._repository_permissions.get(id);
    }

    clear_permissions() {
        this._item_permissions.clear();
        this._repository_permissions.clear();
    }

    toJSON() {
        return {}
    }
}

export {ContentPool}