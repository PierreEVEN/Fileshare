class UploadItem {
    /**
     * @param manager {UploadManager}
     */
    constructor(manager) {

        /**
         * @param {UploadManager}
         */
        this.manager = manager;

        /**
         * @type {null|UploadItem}
         */
        this.parent = null;
    }

    remove() {
        if (this.parent) {
            if (this.parent.children().has(this.name())) {
                this.parent.children().delete(this.name());
                this.parent = null;
                this.manager.events.broadcast('remove_item', this);
            }
        }
        else if (this._repository && this.manager.children().has(this._repository.id)) {
            this.manager.children().delete(this._repository.id);
            this.manager.events.broadcast('remove_item', this);
        }
    }

    /**
     * @return {boolean}
     */
    is_empty() {
        return this.children().size === 0;
    }

    /**
     * Get children
     * @return {Map<String, UploadItem>}
     */
    children() { return new Map() }

    /**
     * @param new_child {UploadItem}
     */
    add_child(new_child) {
        console.error(`Cannot add child ${new_child.name} to`, this.name());
    }

    /**
     * @param child_name {String}
     */
    remove_child(child_name) {
        console.error(`Cannot remove child ${child_name} from`, this.name());
    }

    /**
     * @return {String}
     */
    name() {
        console.error("Not implemented");
    }

    /**
     * @param repository {number}
     * @return {Promise<void>}
     */
    async create_directories(repository) {
        for (const [_, child] of this.children())
            await child.create_directories(repository);
    }
}

export {UploadItem}