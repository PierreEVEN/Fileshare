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

        this._directory = null;
        this._name = name;
    }

    name() {
        return this._name;
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
}

export {UploadDirectory}