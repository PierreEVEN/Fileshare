import {UploadItem} from "./upload_item";

class UploadRepository extends UploadItem {
    /**
     * @param upload_manager {UploadManager}
     * @param repository {Repository}
     */
    constructor(upload_manager, repository) {
        super(upload_manager);

        this._repository = repository;

        /**
         * @type {Map<String, UploadItem>}
         * @private
         */
        this._children = new Map();
    }

    children() {
        return this._children;
    }

    add_child(new_child) {
        if (!this._children.has(new_child.name())) {
            this._children.set(new_child.name(), new_child);
            new_child.parent = this;
            this.manager.events.broadcast('add_item', new_child);
        }
    }

    remove_child(child_name) {
        const child = this._children.get(child_name);
        if (child && child.parent === this) {
            child.parent = null;
            this._children.delete(child_name);
            this.manager.events.broadcast('remove_item', child);
        }
    }

    name() {
        return this._repository.display_name.plain();
    }
}

export {UploadRepository}