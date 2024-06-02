const mime = require('mime');

class FilesystemObject {

    /**
     * @param server_data {Object}
     * @return {FilesystemObject}
     * @constructor
     */
    static FromServer(server_data) {
        const Object = new FilesystemObject();
        Object.id = server_data.id;
        Object.repos = server_data.repos;
        Object.owner = server_data.owner;
        Object.name = decodeURIComponent(server_data.name);
        Object.is_regular_file = server_data.is_regular_file;
        Object.description = decodeURIComponent(server_data.description);
        Object.parent_item = server_data.parent_item;
        if (Object.is_regular_file) {
            Object.size = server_data.size;
            Object.mimetype = decodeURIComponent(server_data.mimetype);
            Object.timestamp = server_data.timestamp;
        }
        return Object;
    }

    constructor() {
        /**
         * @type {string|null}
         */
        this.id = null;

        /**
         * @type {string|null}
         */
        this.repos = null;

        /**
         * @type {string|null}
         */
        this.owner = null;

        /**
         * @type {string|null}
         */
        this.name = null;

        /**
         * @type {boolean|null}
         */
        this.is_regular_file = null;

        /**
         * @type {string|null}
         */
        this.description = null;

        /**
         * @type {string|null}
         */
        this.parent_item = null;

        /**
         * @type {number}
         */
        this.size = 0;

        /**
         * @type {string|null}
         */
        this.mimetype = null;

        /**
         * @type {number|null}
         */
        this.timestamp = null;
    }
}

class ObjectListener {
    constructor() {
        /**
         * @callback callback_object_added
         * @param {*} new_file
         */
        /**
         * Called when the total size or object count of this directory have been updated
         * @type {callback_object_added}
         */
        this.on_add_object = null;

        /**
         * @type {number}
         * @private
         */
        this._id = -1;

        /**
         * @type {ObjectInternalMetadata}
         * @private
         */
        this._parent = null;
    }

    destroy() {
        if (this._parent && this._id)
            this._parent.listeners.delete(this._id);
        this._parent = null;
        this._id = -1;
    }
}

class ObjectInternalMetadata {
    constructor() {
        /**
         * @type {Set<String>}
         */
        this.children = new Set();

        /**
         *
         * @type {Map<number, ObjectListener>}
         */
        this.listeners = new Map();
    }
}

class Filesystem {
    /**
     * @param filesystem_name {string}
     */
    constructor(filesystem_name) {

        /**
         * @type {string}
         */
        this.name = filesystem_name;

        /**
         * @type {Map<string, FilesystemObject>}
         * @private
         */
        this._content = new Map();

        /**
         * @type {Map<string|null, ObjectInternalMetadata>}
         * @private
         */
        this._object_internal_metadata = new Map();

        /**
         * @type {ObjectInternalMetadata}
         * @private
         */
        this._root_meta_data = new ObjectInternalMetadata();

        /**
         * @type {Set<string>}
         * @private
         */
        this._roots = new Set();

        /**
         * @type {boolean}
         * @private
         */
        this._root_dirty = true;
    }

    /**
     * @param object_id {FilesystemObject}
     */
    add_object(object_id) {
        console.assert(object_id.id != null);
        this._content.set(object_id.id, object_id);
        this._roots.add(object_id.id);

        if (!this._object_internal_metadata.has(object_id.id))
            this._object_internal_metadata.set(object_id.id, new ObjectInternalMetadata());

        if (object_id.parent_item) {
            let found_data = this._object_internal_metadata.get(object_id.parent_item);
            if (!found_data) {
                found_data = new ObjectInternalMetadata();
                this._object_internal_metadata.set(object_id.parent_item, found_data);
            }
            found_data.children.add(object_id.id);
        }
        else {
            this._root_meta_data.children.add(object_id.id);
        }
        this._root_dirty = true;
    }

    /**
     * @return {Set<string>}
     */
    get_roots() {
        if (this._root_dirty) {
            this._roots.clear();
            for (const [_, object] of this._content)
                if (!object.parent_item || !this._content.has(object.parent_item))
                    this._roots.add(object.id)
        }
        return this._roots
    }

    /**
     * @param file_id {String}
     * @return {FilesystemObject}
     */
    get_object_data(file_id) {
        return this._content.get(file_id);
    }

    /**
     * @callback callback_sorter
     * @param {FilesystemObject} a
     * @param {FilesystemObject} b
     */

    /**
     * @param parent_id {String|null}
     * @param sorter {callback_sorter}
     * @return {String[]}
     */
    get_objects_in_directory(parent_id, sorter = (a, b) => {
        return a.name > b.name;
    }) {
        let objects = new Set();
        if (!parent_id) {
            objects = this.get_roots();
        } else {
            const metadata = this._object_internal_metadata.get(parent_id);
            if (metadata)
                objects = metadata.children;
        }
        return Array.from(objects).sort(sorter);
    }

    /**
     * @param path {string}
     * @return {null|string}
     */
    get_object_from_path(path) {
        path = path.trim();
        if (path.startsWith('/'))
            path = path.substring(1);

        if (path.endsWith('/'))
            path = path.substring(0, path.length - 1);
        let file = null;
        const path_name = path.split("/");
        if (path_name.length !== 0) {
            for (const name of path_name) {
                let metadata = file ? this._object_internal_metadata.get(file) : this._root_meta_data;

                if (!metadata)
                    break;

                for (const child of metadata.children) {
                    const child_object = this._content.get(child)
                    if (child_object)
                        if (child_object.name === name) {
                            file = child;
                            break;
                        }
                }
            }
        }
        return file;
    }

    clear() {
        this._roots.clear();
        this._content.clear();
        this._object_internal_metadata.clear();
    }

    create_listener(object_id) {
        const metadata = object_id ? this._object_internal_metadata.get(object_id) : this._root_meta_data;
        if (metadata) {
            let id = null;
            do {
                id = Math.random()
            } while (metadata.listeners.has(id));

            const listener = new ObjectListener()
            listener.id = id;
            metadata.listeners.set(id, listener);
            return listener;
        }
        return null;
    }

    /**
     * @param object {string}
     * @return {string[]}
     */
    make_path_to_object(object) {
        const result = [];
        let data = this.get_object_data(object);
        while (data) {
            result.push(object);
            object = data.parent_item;
            data = this.get_object_data(object);
        }
        return result.reverse();
    }
}

module.exports = {Filesystem, FilesystemObject, ObjectListener}