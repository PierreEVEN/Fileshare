class ReposFilter {

    /**
     * @param filesystem {Filesystem}
     */
    constructor(filesystem) {
        console.assert(filesystem, "invalid filesystem")
        this.filesystem = filesystem;
        this.name_filter = '';
    }

    /**
     * @param filter {string}
     */
    set_name_filter(filter) {
        this.name_filter = filter;
    }

    only_files_recursive(enable = true) {
        this._files_recursive = enable;
        return this;
    }

    /**
     * @param parent_directory {number}
     * @returns {FilesystemObject[]}
     */
    get_directory_content(parent_directory) {
        const content = [];

        if (this._files_recursive) {
            for (const elem of this.filesystem.get_objects_in_directory(parent_directory)) {
                const data = this.filesystem.get_object_data(elem);
                if (!data.is_regular_file)
                    content.push(data)
            }
            for (const elem of this.filesystem.get_objects_in_directory_recursive(parent_directory)) {
                const data = this.filesystem.get_object_data(elem);
                if (data.is_regular_file)
                    content.push(data)
            }
        }
        else
            for (const elem of this.filesystem.get_objects_in_directory(parent_directory))
                content.push(this.filesystem.get_object_data(elem))

        // Name filter
        if (this.name_filter.length !== 0) {
            const filter_text = this.name_filter.toLowerCase();
            const filtered_content = [];
            for (const elem of content)
                if (elem.name.plain().toLowerCase().includes(filter_text))
                    filtered_content.push(elem);
            return filtered_content;
        }
        return content;
    }

    /**
     * @param entries {FilesystemObject[]}
     * @param reverse {boolean}
     * @returns {{directories: FilesystemObject[], files: FilesystemObject[]}}
     */
    lex_sort_entries(entries, reverse = false) {
        const directories = [];
        const files = [];

        for (const entry of entries) {
            if (entry.is_regular_file)
                files.push(entry);
            else
                directories.push(entry)
        }
        if (reverse)
            return {
                directories: directories.sort((a, b) => b.name.plain().localeCompare(a.name.plain())),
                files: files.sort((a, b) => b.name.plain().localeCompare(a.name.plain()))
            };
        else
            return {
                directories: directories.sort((a, b) => a.name.plain().localeCompare(b.name.plain())),
                files: files.sort((a, b) => a.name.plain().localeCompare(b.name.plain()))
            };
    }
}

export {ReposFilter};