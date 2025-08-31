import {EventManager} from "../../../src/event_manager";
import {UploadRepository} from "./upload_tree/upload_repository";
import {UploadFile} from "./upload_tree/upload_file";
import {UploadDirectory} from "./upload_tree/upload_directory";
import {EncString} from "../../../src/encstring";
import {Message, NOTIFICATION} from "../../misc/message_box/notification";

class UploadManager {
    /**
     * @param app {FileshareApp}
     */
    constructor(app) {
        /**
         * @type {FileshareApp}
         */
        this.app = app;

        /**
         * @type {EventManager}
         */
        this.events = new EventManager();

        /**
         * @type {Map<number, UploadRepository>}
         */
        this._children = new Map();

        /**
         * @type {boolean}
         * @private
         */
        this._uploading = false;
    }

    /**
     * @param uploading {boolean}
     */
    async set_uploading(uploading) {
        if (this._uploading !== uploading) {
            this._uploading = uploading;
            this.events.broadcast('uploading', uploading);
            if (uploading)
                await this.start_upload();
        }
    }

    /**
     * @return {boolean}
     */
    uploading() {
        return this._uploading
    }

    /**
     * @returns {Map<number, UploadRepository>}
     */
    children() {
        return this._children;
    }

    /**
     * @param repository {Repository}
     * @return {UploadRepository}
     */
    get_repository(repository) {
        if (this._children.has(repository.id))
            return this._children.get(repository.id);
        else {
            const new_repository = new UploadRepository(this, repository);
            this._children.set(repository.id, new_repository);
            this.events.broadcast('add_item', new_repository);
            return new_repository;
        }
    }

    /**
     * @param directory {RemoteItem}
     * @return {UploadDirectory|void}
     */
    async get_directory(directory) {
        if (directory.is_regular_file)
            return console.error(`${directory.absolute_path} is a regular file`);
        const repository = this.app.pool.find_repository(directory.repository);
        const upload_repository = this.get_repository(repository);

        const path = directory.absolute_path.plain().split('/').filter(Boolean);
        return await this._make_existing_directory_tree(upload_repository, path, repository);
    }

    /**
     * @param target {UploadItem}
     * @param relative_path {String[]}
     * @param item {RemoteItem|Repository}
     * @return {Promise<UploadDirectory>}
     */
    async _make_existing_directory_tree(target, relative_path, item) {
        let name = relative_path.pop();
        let child_item = await item.find_child(name);
        let child = target.children().get(name)
        if (!child) {
            console.log(child_item)
            child = new UploadDirectory(this, name, child_item);
            target.add_child(child);
        }
        if (relative_path.length === 0)
            return child;
        else
            return this._make_existing_directory_tree(child, relative_path, child_item);
    }

    /**
     * @param target {UploadItem}
     * @param fs_drop {FileSystemEntry}
     * @return {Promise<UploadItem>}
     * @constructor
     */
    async add_item_from_filesystem_drop(target, fs_drop) {
        if (fs_drop.isFile) {
            let file = await new Promise((resolve) => {
                fs_drop.file(file => {
                    resolve(file);
                })
            })
            return await this.add_item_from_file(target, fs_drop.name, file);
        } else
            return await this.add_item_from_file(target, fs_drop.name, null);
    }


    /**
     * @param target {UploadItem}
     * @param file {File|null}
     * @param name {string}
     * @return {Promise<UploadItem>}
     */
    async add_item_from_file(target, name, file = null) {
        if (!!file) {
            const new_file = new UploadFile(this, file, name);
            target.add_child(new_file);
            return new_file;
        } else {
            const directory = new UploadDirectory(this, name, null);
            target.add_child(directory);
            return directory;
        }
    }

    async start_upload() {
        for (const [id, repository] of this.children())
            await repository.create_directories(id);
    }
}

export {UploadManager}