const {PAGE_CONTEXT} = require("./utils");
const {LOCAL_USER} = require("./user");
const {parse_fetch_result} = require("../../layout/widgets/components/message_box");
const {ClientString} = require("./client_string");

class FilesystemObject {

    /**
     * @param server_data {Object}
     * @return {FilesystemObject}
     * @constructor
     */
    static FromServerData(server_data) {
        const Object = new FilesystemObject();
        Object.id = Number(server_data.id);
        Object.repos = server_data.repos;
        Object.owner = server_data.owner;
        Object.name = new ClientString(server_data.name);
        Object.is_regular_file = server_data.is_regular_file;
        Object.description = server_data.description ? new ClientString(server_data.description) : ClientString.FromClient('');
        Object.parent_item = server_data.parent_item;
        if (Object.is_regular_file) {
            Object.size = Number(server_data.size);
            Object.mimetype = new ClientString(server_data.mimetype);
            Object.timestamp = server_data.timestamp;
        }
        else {
            Object.open_upload = server_data.open_upload;
        }

        return Object;
    }

    /**
     * @param object_id {number}
     * @return {Promise<FilesystemObject>}
     * @constructor
     */
    static async FetchFromServer(object_id) {
        return await new Promise((resolve) => {
            fetch(`${PAGE_CONTEXT.repos_path()}/content/${object_id}`, {
                headers: {
                    'content-authtoken': LOCAL_USER.get_token(),
                    'accept': 'application/json',
                },
            })
                .then(async (response) => await parse_fetch_result(response))
                .then((json) => {
                    resolve(this.FromServerData(json));
                });
        });
    }

    constructor() {
        /**
         * @type {number|null}
         */
        this.id = null;

        /**
         * @type {number|null}
         */
        this.repos = null;

        /**
         * @type {number|null}
         */
        this.owner = null;

        /**
         * @type {ClientString|null}
         */
        this.name = null;

        /**
         * @type {boolean|null}
         */
        this.is_regular_file = null;

        /**
         * @type {ClientString|null}
         */
        this.description = null;

        /**
         * @type {number|null}
         */
        this.parent_item = null;

        /**
         * @type {number}
         */
        this.size = 0;

        /**
         * @type {ClientString|null}
         */
        this.mimetype = null;

        /**
         * @type {number|null}
         */
        this.timestamp = null;

        /**
         * @type {Filesystem}
         */
        this.filesystem = null;
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
         * Called when an object have been modified
         * @type {callback_object_added}
         */
        this.on_update_object = null;

        /**
         * Called when an object have been removed
         * @type {callback_object_added}
         */
        this.on_remove_object = null;

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
         * @type {Set<number>}
         */
        this.children = new Set();

        /**
         * @type {Map<number, ObjectListener>}
         */
        this.listeners = new Map();

        /**
         * @type {number}
         */
        this.content_size = 0;

        /**
         * @type {number}
         */
        this.content_count = 0;
    }
}

class Filesystem {
    /**
     * @param filesystem_name {ClientString}
     */
    constructor(filesystem_name) {

        /**
         * @type {ClientString}
         */
        this.name = new ClientString(filesystem_name);

        /**
         * @type {Map<number, FilesystemObject>}
         * @private
         */
        this._content = new Map();

        /**
         * @type {Map<number, ObjectInternalMetadata>}
         * @private
         */
        this._object_internal_metadata = new Map();

        /**
         * @type {ObjectInternalMetadata}
         * @private
         */
        this._root_meta_data = new ObjectInternalMetadata();

        /**
         * @type {Set<number>}
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
     * @param object {FilesystemObject}
     */
    add_object(object) {
        console.assert(object.id != null);
        object.filesystem = this;
        this._content.set(object.id, object);
        this._roots.add(object.id);

        let object_metadata = this._object_internal_metadata.get(object.id)
        if (!object_metadata) {
            object_metadata = new ObjectInternalMetadata();
            this._object_internal_metadata.set(object.id, object_metadata);
        }

        if (object.is_regular_file) {
            object_metadata.content_count = 1;
            object_metadata.content_size = object.size;
        }

        if (object.parent_item) {
            // Update parent sizes recursively
            let parent_object = object;
            do {
                parent_object = object.parent_item ? this._content.get(parent_object.parent_item) : null;
                if (parent_object) {
                    const parent_object_metadata = this._object_internal_metadata.get(parent_object.id);
                    if (parent_object_metadata) {
                        parent_object_metadata.content_count += object_metadata.content_count;
                        parent_object_metadata.content_size += object_metadata.content_size;
                    }
                } else {
                    this._root_meta_data.content_count += object_metadata.content_count;
                    this._root_meta_data.content_size += object_metadata.content_size;
                }
            } while (parent_object);

            let parent_metadata = this._object_internal_metadata.get(object.parent_item);
            if (!parent_metadata) {
                parent_metadata = new ObjectInternalMetadata();
                parent_metadata.content_size = object_metadata.content_size;
                parent_metadata.content_count = object_metadata.content_count;
                this._object_internal_metadata.set(object.parent_item, parent_metadata);
            }
            parent_metadata.children.add(object.id);
            for (const [_, listener] of parent_metadata.listeners) {
                listener.on_add_object(object.id);
            }
        } else {
            this._root_meta_data.children.add(object.id);
            this._root_meta_data.content_size += object_metadata.content_size;
            this._root_meta_data.content_count += object_metadata.content_count;
            for (const [_, listener] of this._root_meta_data.listeners) {
                listener.on_add_object(object.id);
            }
        }
        this._root_dirty = true;
    }

    /**
     * @param object_id {number}
     * @param only_dereference {boolean} Don't delete children if set to true
     */
    remove_object(object_id, only_dereference = false) {

        const data = this._content.get(object_id);
        if (data) {
            const metadata = this._object_internal_metadata.get(object_id);
            if (metadata && !only_dereference) {
                for (const child of metadata.children)
                    this.remove_object(child);
            }

            const parent_metadata = data.parent_item ? this._object_internal_metadata.get(data.parent_item) : this._root_meta_data;
            if (parent_metadata) {
                parent_metadata.children.delete(object_id)
                for (const [id, listener] of parent_metadata.listeners)
                    listener.on_remove_object(object_id)
            }

            if (!only_dereference)
                this._object_internal_metadata.delete(object_id);
            this._content.delete(object_id);
            if (this._roots.has(object_id)) {
                this._roots.delete(object_id);
                this._root_dirty = true;
            }
        }
    }

    /**
     * @return {Set<number>}
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
     * @param file_id {number}
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
     * @param parent_id {number|null}
     * @param sorter {callback_sorter|null}
     * @return {number[]}
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
        if (sorter)
            return Array.from(objects).sort(sorter);
        return Array.from(objects)
    }

    /**
     * @param path {string}
     * @return {null|number}
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
                        if (child_object.name.plain() === name) {
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
            listener._id = id;
            listener._parent = metadata;
            metadata.listeners.set(id, listener);
            return listener;
        }
        return null;
    }

    /**
     * @param object {number}
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

    /**
     * @param object {number}
     * @return {string}
     */
    make_string_path_to_object(object) {
        let result = "/";
        let data = this.get_object_data(object);
        while (data) {
            result = "/" + data.name + result;
            object = data.parent_item;
            data = this.get_object_data(object);
        }
        return result;
    }

    /**
     * @param object {number}
     * @return {{size: null, count: null}|{size: number, count: number}}
     */
    get_object_content_stats(object) {
        const metadata = object ? this._object_internal_metadata.get(object) : this._root_meta_data;
        if (metadata) {
            return {count: metadata.content_count, size: metadata.content_size}
        }
        return {count: null, size: null};
    }
}

module.exports = {Filesystem, FilesystemObject, ObjectListener}