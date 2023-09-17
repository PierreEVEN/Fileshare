const mime = require('mime');

function prepare_file(file, directory) {
    file.callback_removed = file.callback_removed === undefined ? null : file.callback_removed;
    file.directory = directory;
    file.remove = () => directory.remove_file(file)
    file.is_file = true;
    file.is_directory = false;
    if (!file.mimetype && file.type && file.type !== '')
        file.mimetype = file.type;
    if (!file.mimetype)
        file.mimetype = mime.getType(file.name);

    return file;
}

function clear_file(file) {
    delete file['callback_removed'];
    file['directory'] = undefined;
    delete file['remove'];
    return file;
}

class Directory {
    /**
     * @param name {string}
     * @param parent {Directory|null}
     */
    constructor(name, parent = null) {
        this.parent = parent;
        this.name = name;
        this.size = 0;
        this.content_size = 0;
        this.content_files = 0;

        this["is_directory"] = true;
        this["is_file"] = false;

        this.directories = {};
        this.files = [];

        /**
         * @callback callback_file_added
         * @param {*} new_file
         */

        /**
         * @callback callback_directory_added
         * @param {Directory} new_dir
         */

        /**
         * @callback callback_stats_updated
         * @param {number} content_size
         * @param {number} content_files
         */

        /**
         * @callback callback_removed
         */

        /**
         * @type {callback_file_added}
         */
        this.callback_file_added = null;
        /**
         * @type {callback_directory_added}
         */
        this.callback_directory_added = null;
        /**
         * @type {callback_stats_updated}
         */
        this.callback_stats_updated = null;
        /**
         * @type {callback_removed}
         */
        this.callback_removed = null;
    }

    add_file(file) {
        prepare_file(file, this)
        for (const dir of this.parent_dirs()) {
            dir.content_size += file.size;
            dir.content_files += 1;
            if (dir.callback_stats_updated)
                dir.callback_stats_updated(dir.content_size, dir.content_files);
        }

        this.files.push(file);
        if (this.callback_file_added)
            this.callback_file_added(file);

        return file;
    }

    _remove_if_empty_internal() {
        // auto remove folder if empty
        if (this.files.length === 0 && Object.values(this.directories).length === 0 && this.parent) {
            if (this.callback_removed)
                this.callback_removed();
            delete this.parent.directories[this.name];
            this.parent._remove_if_empty_internal();
            this.parent = null;
        }
    }

    remove_file(file) {
        let found = false;
        for (let i = 0; i < this.files.length; ++i) {
            if (this.files[i] === file) {
                found = true;
                this.files.splice(i, 1);
            }
        }

        // Update stats
        if (found) {
            for (const dir of this.parent_dirs()) {
                dir.content_size -= file.size;
                dir.content_files -= 1;
                if (dir.callback_stats_updated)
                    dir.callback_stats_updated(dir.content_size, dir.content_files);
            }

            if (file['callback_removed'])
                file['callback_removed']();

            clear_file(file);
            this._remove_if_empty_internal();
            return file;
        }
        return null;
    }

    /**
     * @return {string}
     */
    absolute_path() {
        return this.parent ? `${this.parent.absolute_path()}${this.name}/` : '/';
    }

    /**
     * @return {Directory[]}
     */
    parent_dirs() {
        return this.parent ? [this].concat(this.parent.parent_dirs()) : [this];
    }

    remove() {
        for (let i = this.files.length - 1; i >= 0; --i) {
            this.remove_file(this.files[i]);
        }

        for (const dir of Object.values(this.directories))
            dir.remove();

        if (this.parent)
            delete this.parent.directories[this.name]

        if (this.callback_removed)
            this.callback_removed();

        if (this.parent)
            this.parent._remove_if_empty_internal();
        this.parent = null;
    }
}

class Filesystem {
    /**
     * @param root_name {string}
     */
    constructor(root_name) {
        this.root = new Directory(root_name, null);
    }

    /**
     * @param file
     * @param path {string}
     * @return {null|*}
     */
    add_file(file, path) {
        if (file.size === 0)
            return;
        const directory = this.directory_from_path(path, true);
        return directory.add_file(file);
    }

    /**
     * @param path {string}
     * @param create_if_not_found {boolean}
     * @return {Directory|null}
     */
    directory_from_path(path, create_if_not_found = false) {
        const list_path = [];
        for (const item of path.split('/'))
            if (item !== '')
                list_path.push(item);
        list_path.reverse();

        const ite = (dir, remaining) => {
            if (remaining.length === 0)
                return dir;

            const name = remaining.pop();
            if (dir.directories[name])
                return ite(dir.directories[name], remaining);
            else if (create_if_not_found) {
                dir.directories[name] = new Directory(name, dir);
                if (dir.callback_directory_added)
                    dir.callback_directory_added(dir.directories[name])
                return ite(dir.directories[name], remaining);
            }
            return null;
        };
        return ite(this.root, list_path)
    }

    remove_file(file) {
        if (!file.directory)
            return null;

        return file.directory.remove_file(file);
    }

    get_random_file() {
        const internal_get_random_file = (dir) => {
            if (dir.files.length > 0)
                return dir.files[0];

            const dirs = Object.values(dir.directories);
            for (const dir of dirs) {
                const file = internal_get_random_file(dir);
                if (file)
                    return file;
            }
            return null;
        }

        return internal_get_random_file(this.root);
    }

    clear() {
        for (let i = this.root.files.length - 1; i >= 0; --i)
            this.remove_file(this.root.files[i]);

        for (const directory of Object.values(this.root.directories))
            directory.remove();
    }
}

export {Filesystem}