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
}

export {UploadItem}