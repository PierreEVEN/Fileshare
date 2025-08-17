
let REQUEST_INDEX = 0;

class ContentRequest {
    constructor() {
        /**
         * @type {Map<number, boolean>}
         * @private
         */
        this._items = new Map();

        /**
         * @type {Set<number>}
         * @private
         */
        this._repositories = new Set();

        /**
         * @type {Set<number>}
         * @private
         */
        this._users = new Set();

        /**
         * @type {Set<number>}
         * @private
         */
        this._directory_content = new Set();

        /**
         * @type {Set<number>}
         * @private
         */
        this._repository_roots = new Set();

        /**
         * @type {Set<number>}
         * @private
         */
        this._trash_roots = new Set();

        /**
         * @type {number[]}
         */
        this.indices = [++REQUEST_INDEX];
    }

    /**
     * @param other {ContentRequest}
     */
    merge(other) {
        for (const [key, value] of other._items) {
            if (this._items.has(key)) {
                if (this._items.get(key) !== value)
                    this._items.set(key, value);
                return;
            }
            this._items.set(key, value);
        }
        for (const key of other._repositories)
            this._repositories.add(key);
        for (const key of other._users)
            this._users.add(key);
        for (const key of other._directory_content)
            this._directory_content.add(key);
        for (const key of other._repository_roots)
            this._repository_roots.add(key);
        for (const key of other._trash_roots)
            this._trash_roots.add(key);
        this.indices.concat(other.indices);
    }

    /**
     * @param content_pool {ContentPool}
     * @returns {Object}
     */
    make_body(content_pool) {
        const result = {
            items: [],
            repositories: [],
            users: [],
            directory_content: [],
            repository_roots: [],
            trash_roots: [],
            content_to: [],
        }

        for (const [item, includes_parents] of this._items) {
            const existing = content_pool.find_item(item);
            if (existing) {
                if (includes_parents && !content_pool.has_hierarchy_to(existing.parent_item))
                    result.content_to.push(item);
                continue;
            }
            result.items.push(item);
            if (includes_parents)
                result.content_to.push(item);
        }

        for (const repository of this._repositories) {
            if (content_pool.find_repository(repository))
                continue;
            result.repositories.push(repository);
        }

        for (const user of this._users) {
            if (content_pool.find_user(user))
                continue;
            result.users.push(user);
        }

        for (const directory of this._directory_content) {
            const dir = content_pool.find_item(directory);
            if ((!dir && this._items.has(directory)) || (dir && !dir._children))
                result.directory_content.push(directory);
        }

        for (const repos of this._repository_roots) {
            const repository = content_pool.find_repository(repos);
            if (!repository || (repository && !repository._children)) {
                result.repository_roots.push(repos);
                if (!this._repositories.has(repos))
                    result.repositories.push(repos);
            }
        }

        for (const repos of this._trash_roots) {
            const repository = content_pool.find_repository(repos);
            if (!repository || (repository && !repository.trash)) {
                result.trash_roots.push(repos);
                if (!this._repositories.has(repos))
                    result.repositories.push(repos);
            }
        }

        if (result.items.length === 0 &&
            result.repositories.length === 0 &&
            result.users.length === 0 &&
            result.directory_content.length === 0 &&
            result.repository_roots.length === 0 &&
            result.trash_roots.length === 0 &&
            result.content_to.length === 0)
            return null;
        return result;
    }

    /**
     * Fetch the root content of input repositories
     * @param repositories {number[]}
     * @return {ContentRequest}
     */
    repository_root(repositories) {
        for (const repository of repositories)
            this._repository_roots.add(repository)
        return this;
    }

    /**
     * Fetch the trash content of input repositories
     * @param repositories {number[]}
     * @return {ContentRequest}
     */
    trash_root(repositories) {
        for (const repository of repositories)
            this._trash_roots.add(repository)
        return this;
    }

    /**
     * Fetch items
     * @param items {number[]}
     * @param includes_parents {boolean}
     * @return {ContentRequest}
     */
    item(items, includes_parents = false) {
        for (const item of items)
            this._items.set(item, includes_parents)
        return this;
    }

    /**
     * Fetch repositories
     * @param repositories {number[]}
     * @return {ContentRequest}
     */
    repository(repositories) {
        for (const repository of repositories)
            this._repositories.add(repository)
        return this;
    }

    /**
     * Fetch repositories
     * @param users {number[]}
     * @return {ContentRequest}
     */
    user(users) {
        for (const user of users)
            this._users.add(user)
        return this;
    }

    /**
     * Fetch input directories content
     * @param directories {number[]}
     * @return {ContentRequest}
     */
    directory_content(directories) {
        for (const directory of directories)
            this._directory_content.add(directory)
        return this;
    }
}

export {ContentRequest}