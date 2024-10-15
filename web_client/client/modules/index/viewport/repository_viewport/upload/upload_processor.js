import {Message, NOTIFICATION} from "../../../tools/message_box/notification";
import {FilesystemItem} from "../../../../../types/filesystem_stream";
import {UploadItem} from "./upload_item";
import {EncString} from "../../../../../types/encstring";
import {MemoryTracker} from "../../../../../types/memory_handler";

class UploadState {
    constructor(data) {
        this.id = data.id;
        this.finished = data.finished;
        if (data.item)
            this.item = FilesystemItem.new(data.item);
    }
}

class UploadProcessor extends MemoryTracker {

    /**
     * @param item {UploadItem}
     * @param uploader {Uploader}
     */
    constructor(item, uploader) {
        super(UploadProcessor);
        /**
         * @type {UploadItem}
         */
        this.item = item;
        /**
         * @type {Repository}
         */
        this.repository = uploader.viewport.repository;
        this.uploader = uploader;

        this.upload_signal = new Promise((resolve, reject) => {
            this.upload_finished = resolve;
            this.upload_failed = reject;
        })

        this._cursor = 0;

        this.waiting_unpause = false;
        this.pause_event = uploader.event.add('pause', (pause) => {
            if (!pause && this.waiting_unpause) {
                this._send_next();
            }
        })
    }

    delete() {
        super.delete();
        this.pause_event.remove();
    }

    _init() {
        /**
         * @type {XMLHttpRequest}
         * @private
         */
        this._request = new XMLHttpRequest();

        this._request.onreadystatechange = () => {
            if (this._request.readyState === 4) {
                if (this._request.status === 0)
                    return this._fail("connection closed")
                if (this._request.response.length === 0)
                    return this._fail(`Unhandled response`, `${this._request.status}`)
                if (this._request.status !== 200)
                    return this._fail(this._request.response)
                this.state = new UploadState(JSON.parse(this._request.response));
                if (this.state.finished) {
                    this.uploader.progress(this.item.file.size, this.item.file.size);
                    return this.upload_finished();
                }
                else {
                    this._send_next();
                }
            }
        };
        this.processed_chunk_data = 0;
        this._request.upload.addEventListener("progress", (event) => {
            this.uploader.progress(this.processed_chunk_data + event.loaded, this.item.file.size);
            event.loaded
        });
        this._send_next();
    }

    _fail(message) {
        NOTIFICATION.error(new Message(message).title(`Failed tu upload '${this.item.name}'`));
        this.upload_failed();
    }


    static MAX_BATCH_SIZE = 50 * 1024 * 1024;
    _send_next() {
        if (this.uploader.pause) {
            this.waiting_unpause = true;
            return;
        }
        this.waiting_unpause = false;
        const start = this._cursor;
        this.processed_chunk_data = start;
        this._cursor = Math.min(this._cursor + UploadProcessor.MAX_BATCH_SIZE, this.item.file.size)

        const chunk =  this.item.file.slice(start, this._cursor);

        this._request.open("POST", '/api/item/send/');
        if (!this.state) {
            this._request.setRequestHeader('Content-Name', EncString.from_client(this.item.name).encoded());
            this._request.setRequestHeader('Content-Size', this.item.file.size.toString());
            this._request.setRequestHeader('Content-Timestamp', this.item.file.lastModified.toString());
            this._request.setRequestHeader('Content-Mimetype', EncString.from_client(this.item.mimetype).encoded());
            this._request.setRequestHeader('Content-Repository', this.repository.id.toString());
            if (this.item.parent.directory) {
                this._request.setRequestHeader('Content-Parent', this.item.parent.directory.id.toString());
            }
        } else {
            this._request.setRequestHeader('Content-Id', this.state.id);
        }
        this._request.send(chunk);
    }


    async upload() {
        if (this.item.parent instanceof UploadItem) {
            await this.item.parent.create_directory(this.repository.content);
        }

        this._init();

        await this.upload_signal;
    }
}

export {UploadProcessor}