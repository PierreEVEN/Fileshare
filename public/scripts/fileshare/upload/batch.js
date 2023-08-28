class Batch {

    constructor() {
        this.root = {folders: {}, files: [], name: 'root', size: 0, total_files: 0}
    }

    add_file(file, path) {
        const path_list = path ? path.split('/') : [];
        for (let i = path_list.length - 1; i >= 0; --i) {
            if (path_list[i].length === 0 || path_list[i] === '/')
                path_list.splice(i, 1);
        }


        file.mimetype = file.type && file.type !== '' ? file.type : module.mime.getType(file.name);

        file.virtual_path = path;
        this._add_file_internal(file, path_list.reverse(), this.root);
    }

    _add_file_internal(file, path_list, target) {

        target.total_files += 1;
        target.size += file.size;

        if (path_list.length > 0) {
            const current_dir = path_list.pop()

            if (!target.folders[current_dir]) {
                target.folders[current_dir] = {folders: {}, files: [], name: current_dir, total_files: 0, size: 0}
            }
            this._add_file_internal(file, path_list, target.folders[current_dir])
        } else
            target.files.push(file);
    }

    _pop_next_file_internal(source) {
        for (const [name, folder] of Object.entries(source.folders)) {
            const file = this._pop_next_file_internal(folder);
            if (file)
                return file;
            else
                delete source.folders[name];
        }

        if (source.files.length > 0)
            return source.files.pop();

        return null;
    }

    pop_next_content() {
        let remaining_total_size = 200 * 1024 * 1024; // max size is 200 Mo
        let remaining_file_count = 20; // max file count is 20

        const files = [];

        do {
            const file = this._pop_next_file_internal(this.root);
            if (!file)
                break;

            remaining_file_count -= 1;
            remaining_total_size -= file.size;
            files.push(file);
        }
        while (remaining_file_count > 0 && remaining_total_size > 0);

        return files;
    }
}

export {Batch}