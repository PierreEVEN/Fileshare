import {UploadItem} from "./upload_item";
import {DirectoryContentProvider} from "../../../../../types/viewport_content/providers";
import {UploadProcessor} from "./upload_processor";
import {EventManager} from "../../../../../types/event_manager";
import {MemoryTracker} from "../../../../../types/memory_handler";
import {humanFileSize, seconds_to_str} from "../../../../../utilities/utils";

require("./uploader.scss")

/**
 * @param directory {boolean}
 * @return {Promise<UploadItem[]>}
 */
async function open_file_picker(directory) {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    if (directory) {
        inputElement.webkitdirectory = true;
        inputElement.directory = true;
        inputElement.multiple = true;
    } else {
        inputElement.multiple = true;
    }
    return await new Promise((resolve) => {
        inputElement.addEventListener("cancel", () => {
            resolve([]);
        });
        inputElement.addEventListener("change", (e) => {
            const roots = new Map();
            const files = [];

            /**
             * @param remaining_path {string[]}
             * @param parent {UploadItem|null}
             * @return {UploadItem|null}
             */
            function find_or_create_directory(remaining_path, parent) {
                if (remaining_path.length === 0)
                    return null;
                let dir_name = remaining_path.pop();
                let available = parent ? parent.children : roots;
                if (!available.has(dir_name)) {
                    let directory = UploadItem.FromUploadModal(dir_name);
                    if (!parent)
                        files.push(directory);
                    else
                        parent.add_child(directory);
                    available.set(dir_name, directory);
                }
                if (remaining_path.length === 0)
                    return available.get(dir_name);
                else
                    return find_or_create_directory(remaining_path, available.get(dir_name));
            }

            for (const file of e.target['files']) {
                const directory_path = (file.webkitRelativePath ? file.webkitRelativePath : '').split('/').filter(Boolean);
                directory_path.pop();
                let directory = find_or_create_directory(directory_path.reverse(), null);
                let item = UploadItem.FromUploadModal(file.name, file);
                if (directory) {
                    directory.add_child(item);
                } else
                    files.push(item);
            }
            resolve(files);
        })
        inputElement.dispatchEvent(new MouseEvent("click"));
    })
}

class Uploader extends MemoryTracker {
    /**
     * @param container {HTMLElement}
     * @param viewport {RepositoryViewport}
     */
    constructor(container, viewport) {
        super(Uploader);
        this.expanded = false;
        this.viewport = viewport;
        let div = require("./uploader.hbs")({}, {
            start_upload: () => this.set_uploading(!this.uploading),
            expand: (e) => {
                e.preventDefault();
                this.expand(!this.expanded)
            },
            pause: () => {
                this.set_pause(!this.pause);
            },
            add_files: async () => {
                for (const item of await open_file_picker(false)) {
                    await this.add_item(item)
                }
            },
            add_directory: async () => {
                for (const item of await open_file_picker(true)) {
                    await this.add_item(item)
                }
            }
        });
        this.pause = false;
        this._elements = div.elements;
        this.total_items = 0;
        this.total_size = 0;
        container.append(div);
        /**
         * @type {Map<string, UploadItem>}
         */
        this.children = new Map();
        this.handled_directories = new Map();

        this.uploading = false;
        this.pause = false;
        this.event = new EventManager();
        this.total_to_upload = 0;
        this.uploaded = 0;

        this._time_records = [];

        this.current_progress = 0;

        this._data_update_timeout = setInterval(() => {
            if (!this.uploading || this.pause)
                return;
            this._time_records.push({data: this.current_progress, time: performance.now()});

            if (this._time_records.length !== 0) {
                const last = this._time_records[this._time_records.length - 1];
                let delta_data = last.data - this._time_records[0].data;
                let delta_time = (last.time - this._time_records[0].time) / 1000;
                let data_per_second = delta_data / delta_time;
                const remaining = this.total_to_upload - this.current_progress
                this._elements.speed.innerText = humanFileSize(data_per_second) + '/s';
                this._elements.time.innerText = '~' + seconds_to_str(remaining / data_per_second);
            }

            if (this._time_records.length > 100) {
                this._time_records.shift();
            }
        }, 100);
    }

    expand(expanded) {
        if (expanded === this.expanded)
            return;
        this.expanded = expanded;
        if (this.expanded)
            this._elements.uploader.classList.add("expanded")
        else {
            this._elements.uploader.classList.remove("expanded")
            if (this.children.size === 0)
                this.viewport.close_upload_container();
        }
    }

    set_pause(pause) {
        if (this.pause === pause)
            return;
        this._elements.pause_img.src = pause ? "/public/images/icons/icons8-play-64.png" : "/public/images/icons/icons8-pause-30.png";
        this.pause = pause;
        this._time_records = [];
        this.current_progress = this.uploaded;
        this.event.broadcast('pause', this.pause);
    }

    set_uploading(uploading) {
        if (this.uploading === uploading)
            return;
        this.uploading = uploading;

        if (uploading) {
            this._elements.upload_button.style.display = 'none';
            this._elements.upload_in_progress.style.display = 'flex';
            this.start_upload().catch(err => console.error("upload failed :", err));
        } else {
            this._elements.upload_in_progress.style.display = 'none';
            if (this.children.size > 0)
                this._elements.upload_button.style.display = 'flex';
        }
    }


    async start_upload() {

        this.total_to_upload = this.total_size;
        this._time_records = [];
        this.current_progress = this.uploaded;
        /**
         * @param root {UploadItem}
         * @return {UploadItem}
         */
        const search_in_roots = (root) => {
            if (root.is_regular_file)
                return root;
            for (const ite of root.children.values()) {
                const found = search_in_roots(ite);
                if (found)
                    return found;
            }
            return null;
        }

        do {
            /**
             * @type {UploadItem}
             */
            let found_item = null;
            for (const root of this.children.values()) {
                const found = search_in_roots(root);
                if (found) {
                    found_item = found;
                    break;
                }
            }

            if (!found_item)
                break;

            found_item.remove();

            if (found_item.parent instanceof UploadItem) {
                await found_item.parent.create_directory(this.viewport.repository.content);
            }
            const existing = await this.viewport.repository.content.find_child(found_item.name, found_item.parent.directory);
            if (existing) {
                console.warn("Existe deja !!")
                continue
            }

            if (this.processor)
                this.processor.delete()
            this.processor = new UploadProcessor(found_item, this);
            this._elements.upload_file_name.innerText = found_item.name;
            this._elements.upload_file_size.innerText = humanFileSize(found_item.file.size);
            await this.processor.upload().catch(() => {
            });
            this.uploaded += found_item.file.size;
        } while (true);
        this.viewport.close_upload_container();
    }

    delete() {
        super.delete();
        if (this.processor)
            this.processor.delete();
        this.processor = null;
        if (this._data_update_timeout)
            clearTimeout(this._data_update_timeout)
        this._data_update_timeout = null;
    }

    /**
     * @param uploaded {number}
     * @param total {number}
     */
    progress(uploaded, total) {
        this.current_progress = this.uploaded + uploaded;
        const current = (this.uploaded + uploaded) / this.total_to_upload;
        const after = (this.uploaded + total) / this.total_to_upload;
        this._elements.progress.style.width = `${current * 100}%`;
        this._elements.progress_after.style.width = `${after * 100}%`;
        this._elements.percents.innerText = `${Math.trunc(current * 100)}%`
    }

    /**
     * @param item {UploadItem}
     */
    async add_item(item) {
        const provider = this.viewport.content.get_content_provider();
        if (provider && provider instanceof DirectoryContentProvider) {
            /**
             * @type {FilesystemItem}
             */
            const directory_item = provider['directory'];
            const directory = await this._add_existing_directory(directory_item);
            directory.add_child(item);
        } else {
            if (this.children.has(item.name))
                return;
            item.parent = this;
            this.children.set(item.name, item);
            item.instantiate(this._elements.file_list);
            this.parent_add_stats(item.total_size, item.total_items);
        }

        if (this.children.size > 0 && !this.uploading)
            this._elements.upload_button.style.display = 'flex';
    }

    parent_add_stats(size, count) {
        this.total_items += count;
        this.total_size += size;
        this._elements.infos.innerText = `${this.total_items} fichiers (${humanFileSize(this.total_size)})`;
    }

    /**
     * @param directory {FilesystemItem}
     * @return {Promise<UploadItem>}
     * @private
     */
    async _add_existing_directory(directory) {
        const existing = this.handled_directories.get(directory.id);
        if (existing) {
            return existing;
        } else {
            const entry = UploadItem.FromRepositoryDirectory(directory)
            if (directory.parent_item) {
                const parent = await this._add_existing_directory(await directory.filesystem().fetch_item(directory.parent_item));
                parent.add_child(entry);
            } else {
                this.children.set(entry.name, entry);
                entry.parent = this;
                entry.instantiate(this._elements.file_list);
            }

            this.handled_directories.set(directory.id, entry);
            return entry;
        }
    }

    _remove_child(name) {
        this.children.delete(name);
        if (this.children.size <= 0)
            this._elements.upload_button.style.display = 'none';
    }
}

export {Uploader}