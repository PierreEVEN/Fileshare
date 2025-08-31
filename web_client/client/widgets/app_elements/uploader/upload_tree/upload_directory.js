import {UploadItem} from "./upload_item";
import {EncString} from "../../../../src/encstring";
import {Message, NOTIFICATION} from "../../../misc/message_box/notification";

class UploadDirectory extends UploadItem {
    /**
     * @param manager {UploadManager}
     * @param name {String}
     * @param directory {RemoteItem}
     */
    constructor(manager, name, directory) {
        super(manager);

        /**
         * @type {RemoteItem}
         * @private
         */
        this._directory = directory;
        /**
         * @type {String}
         * @private
         */
        this._name = name;

        /**
         * @type {Map<String, UploadItem>}
         * @private
         */
        this._children = new Map()
    }

    name() {
        return this._name;
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

    async upload() {
        if (this._directory)
            return;
        let directories;
        if (this.parent instanceof UploadDirectory) {
            directories = await this.app.fetch_api('item/new-directory', 'POST',
                [{
                    name: EncString.from_client(this._name),
                    repository: this.parent._directory.repository,
                    parent_item: this.parent._directory.id
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dossier")));
        } else {
            directories = await this.app.fetch_api('item/new-directory', 'POST',
                [{
                    name: EncString.from_client(this._name),
                    repository: this.parent._repository.id,
                    parent_item: null
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dossier")));
        }

        console.assert(directories.length === 1)
        this._directory = await this.content_pool._register_item(directories[0]);
    }

    async create_directories(repository) {
        await super.create_directories(repository);

        if (!this._directory) {
            console.log("Create directory ", this.name())
            const created_directories = await this.manager.app.fetch_api('item/new-directory', 'POST',
                [{
                    name: EncString.from_client(this.name()),
                    repository: repository,
                    parent_item: this.parent && this.parent._directory ? this.parent._directory.id : null
                }]);
            console.assert(created_directories.length === 1, "Didn't create the right amount of directories");
            this._directory = await this.manager.app.pool._register_item(created_directories[0]);
        }
    }
}

export {UploadDirectory}