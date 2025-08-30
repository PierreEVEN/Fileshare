import {UploadItem} from "./upload_item";

class UploadRepository extends UploadItem {
    /**
     * @param repository {Repository}
     */
    constructor(repository) {
        super(repository.get_pool());

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
        }
    }

    remove_child(child_name) {
        const child = this._children.get(child_name);
        if (child && child.parent === this) {
            child.parent = null;
            this._children.delete(child_name);
        }
    }

    name() {
        return this._repository.id;
    }
}

export {UploadRepository}