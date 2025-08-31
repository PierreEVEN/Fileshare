import {UploadItem} from "./upload_item";

class UploadFile extends UploadItem {
    /**
     * @param manager {UploadManager}
     * @param file {File}
     * @param name {String}
     */
    constructor(manager, file, name) {
        super(manager);
        this._file = file;
        this._name = name;
    }

    /**
     * @returns {Promise<string>}
     */
    async mimetype() {
        if (!this._mimetype) {
            if (this._file.type)
                this._mimetype = this._file.type;
            else
                this._mimetype = (await import('mime')).default.getType(this._file.name);
        }
        return this._mimetype;
    }

    name() {
        return this._name;
    }
}

export {UploadFile}