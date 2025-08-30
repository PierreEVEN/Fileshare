import {UploadItem} from "./upload_item";

class UploadFile extends UploadItem {
    /**
     * @param manager {UploadManager}
     * @param file {File}
     * @param name {String}
     * @param mimetype {String}
     */
    constructor(manager, file, name, mimetype) {
        super(manager);

        this._file = file;
        this._name = name;
        this._mimetype = mimetype;
    }

    name() {
        return this._name;
    }
}

export {UploadFile}