import {print_message} from "../widgets/message_box.js";
import {PAGE_CONTEXT} from "./utils";

class TransferStats {
    constructor() {
        this.timestamp = performance.now();
        this.last_sent = null;
        this.total = 0;

        this.speed_measures = [];
    }

    speed() {
        let average = 0;
        for (const measure of this.speed_measures)
            average += measure;
        average /= this.speed_measures.length;
        return average;
    }

    remaining() {
        return (this.total - this.last_sent) / this.speed();
    }

    update(sent, total) {
        if (!this.last_sent) {
            this.last_sent = sent;
            return;
        }
        if (performance.now() - this.timestamp < 100)
            return;

        const added = sent - this.last_sent;
        const elapsed = performance.now() - this.timestamp;
        this.timestamp = performance.now();
        const local_speed = added / elapsed * 1000;
        this.speed_measures.push(local_speed);
        this.total = total;
        this.last_sent = sent;
    }
}

class ChunkedFileStream {

    static MAX_BATCH_SIZE = this.max_batch_size = 50 * 1024 * 1024;

    /**
     * @param file {File}
     */
    constructor(file) {

        /**
         * @type {File}
         */
        this.file = file;

        /**
         * @type {number}
         * @private
         */
        this._cursor = 0;

        /**
         * @type {number}
         * @private
         */
        this._last_cursor = 0;

        /**
         * @type {null|number}
         */
        this.stream_id = null;
    }

    get_next_chunk() {
        this._last_cursor = this._cursor;
        if (!this.file)
            return null;
        if (this._cursor === this.file.size)
            return null;
        this._cursor += Math.min(this.file.size - this._cursor, ChunkedFileStream.MAX_BATCH_SIZE);
        return this.file.slice(this._last_cursor, this._cursor);
    }

    cancel_chunk() {
        this._cursor = this._last_cursor;
    }

    chunk_number() {
        return Math.ceil(this.file.size / ChunkedFileStream.MAX_BATCH_SIZE);
    }

    sent_chunk() {
        return Math.floor(this._last_cursor / ChunkedFileStream.MAX_BATCH_SIZE);
    }
}

class UploadStream {

    /**
     * @callback callback_on_progress
     * @param file {File}
     * @param sent_chunks {number}
     * @param total_chunks {number}
     * @param sent_bytes {number}
     * @param total_bytes {number}
     * @param process_percent {number}
     */

    /**
     * @callback callback_file_sent
     * @param file {File}
     * @param file_id {number}
     */

    /**
     * @callback callback_file_canceled
     * @param file {File}
     */

    /**
     *
     * @param file_stream {ChunkedFileStream}
     * @param url {string}
     * @param on_progress {callback_on_progress}
     * @param on_file_sent {callback_file_sent}
     * @param on_cancel {callback_file_canceled}
     */
    constructor(file_stream, url, on_progress, on_file_sent, on_cancel) {
        /**
         * @type {callback_file_sent}
         * @private
         */
        this._on_file_sent = on_file_sent;

        /**
         * @type {callback_file_sent}
         * @private
         */
        this._on_cancel = on_cancel;

        /**
         * @type {callback_on_progress}
         * @private
         */
        this._on_progress = on_progress;

        /**
         * @type {string}
         * @private
         */
        this._url = url;

        /**
         * @type {ChunkedFileStream}
         * @private
         */
        this._file_stream = file_stream;

        /**
         * @type {XMLHttpRequest}
         * @private
         */
        this._request = new XMLHttpRequest();

        const this_ref = this;
        this._request.onreadystatechange = () => {
            if (!this_ref._running)
                return;
            if (this_ref._request.readyState === 4) {
                if (this_ref._request.status === 0)
                    return print_message("error", `Server error`, "connection closed")
                if (this_ref._request.response.length === 0)
                    return print_message("error", `Unhandled response`, `${this_ref._request.status}`)
                this_ref._handle_result(this_ref._request.status, JSON.parse(this_ref._request.response));
            }
        };

        this._request.upload.addEventListener("progress", (event) => {
            this_ref._chunk_progress = event.loaded;
            this._update_progress();
        });

        /**
         * @type {null|string}
         * @private
         */
        this._stream_id = null;

        /**
         * @type {number}
         * @private
         */
        this._process_percent = 0;

        /**
         * @type {number}
         * @private
         */
        this._chunk_progress = 0;

        /**
         * @type {null|number}
         * @private
         */
        this._file_id = null;
    }

    go() {
        this._running = true;
        this._push_next_chunk();
    }

    hold() {
        this._running = false;
        this._request.abort();
        this._file_stream.cancel_chunk();
    }

    /**
     * @param code {number}
     * @param data {object: {stream_id:string, process_percent:number, message:string, file_id:number}}
     */
    _handle_result(code, data) {
        if (code !== 200 || !data) {
            this.hold();
            if (data && data.message)
                print_message('error', data.message.title, data ? data.message.content : 'unknown error');
            else
                print_message('error', "Upload failed", 'unknown error');
            console.error(`Upload failed :`, data);
            this._on_cancel(this._file_stream.file);
            return;
        }

        if (data.message)
            print_message('info', data.message.title ? data.message.title : data.message, data.message.content ? data.message.content : "");

        if (!data.stream_id) {
            this.hold();
            return;
        }

        this._process_percent = Number(data.process_percent);

        this._update_progress();

        /**
         * @type {number}
         * @private
         */
        this._stream_id = data.stream_id;

        if (data.file_id && !Number.isNaN(Number(data.file_id)))
            this._file_id = Number(data.file_id);
        this._push_next_chunk();
    }

    _push_next_chunk() {
        if (!this._running)
            return;

        const chunk = this._file_stream.get_next_chunk();
        if (!chunk) {
            if (this._process_percent < 1.0) {
                if (!this._stream_id) {
                    this.hold();
                    print_message('error', `Invalid stream id received during process step`);
                    console.error(`Invalid stream id received during process step`);
                    return;
                }

                setTimeout(() => {
                    this._request.open("POST", this._url);
                    this._request.setRequestHeader('content-token', this._stream_id.toString());
                    this._request.send();
                }, 500);
                return;
            } else
                return this._on_file_sent(this._file_stream.file, this._file_id);
        }

        this._request.open("POST", this._url);
        if (!this._stream_id) { // @TODO : FIX HEADERS (probably something wrong here)
            this._request.setRequestHeader('content-name', encodeURIComponent(this._file_stream.file.name));
            this._request.setRequestHeader('content-size', this._file_stream.file.size);
            this._request.setRequestHeader('content-timestamp', this._file_stream.file.timestamp);
            this._request.setRequestHeader('content-mimetype', this._file_stream.file.mimetype);
            const absolute_path = (selector.filesystem.make_string_path_to_object(selector.get_current_directory()) + this._file_stream.file.directory.absolute_path().replaceAll('//', '/'));
            this._request.setRequestHeader('content-path', encodeURIComponent(absolute_path));
            if (this._file_stream.file.description)
                this._request.setRequestHeader('content-description', this._file_stream.file.description ? encodeURIComponent(this._file_stream.file.description) : '');
        } else {
            this._request.setRequestHeader('content-token', this._stream_id.toString());
        }
        this._request.send(chunk);
    }

    _update_progress() {
        if (this._on_progress) {
            this._on_progress(this._file_stream.file, this._file_stream.sent_chunk(), this._file_stream.chunk_number(), this._file_stream.sent_chunk() * ChunkedFileStream.MAX_BATCH_SIZE + this._chunk_progress, this._file_stream.file.size, this._process_percent);
        }
    }
}

class FilesystemUpload {
    /**
     * @param filesystem {Filesystem}
     * @param url {string}
     */
    constructor(filesystem, url) {
        /**
         * @type {Filesystem}
         * @private
         */
        this._filesystem = filesystem;

        /**
         * @type {boolean}
         */
        this.is_running = false;

        /**
         * @type {string}
         */
        this.url = url;

        this.total_content_size = this._filesystem.root.content_size;
        this.total_content_sent = 0;

        this.total_file_count = this._filesystem.root.content_files;
        this.total_file_sent = 0;

        /**
         * @callback callback_finished
         */
        /**
         * @type {null|callback_finished}
         */
        this.callback_finished = null;

        /**
         * @callback callback_file_uploaded
         * @param {File}
         */
        /**
         * @type {null|callback_file_uploaded}
         */
        this.callback_file_uploaded = null;

        /**
         * @type {UploadStream}
         * @private
         */
        this._current_stream = null;

        /**
         * @callback callback_update_progress
         * @param file_name {string}
         * @param file_size {number}
         * @param uploaded_files {number}
         * @param total_files {number}
         * @param uploaded_size {number}
         * @param file_uploaded_size {number}
         * @param total_size {number}
         * @param process_percent {number|null}
         * @param speed {number}
         * @param remaining_time {number}
         */
        /**
         * @type {callback_update_progress}
         */
        this.callback_update_progress = null;

        this.on_stop = null;
    }

    start() {
        this.transfer_stats = new TransferStats();
        this.is_running = true;
        if (this._current_stream) {
            this._current_stream.go();
        } else {
            this.total_content_size = this._filesystem.root.content_size;
            this.total_content_sent = 0;
            this.total_file_count = this._filesystem.root.content_files;
            this.total_file_sent = 0;
            this.total_file_sent = 0;
            this._next();
        }
    }

    _next() {
        const this_ref = this;
        const new_file = this._filesystem.get_random_file();
        if (!new_file)
            return this.stop();
        this._current_stream = new UploadStream(new ChunkedFileStream(new_file), this.url,
            (file, sent_chunks, total_chunks, sent_bytes, total_bytes, process_percent) => {
                if (this_ref.callback_update_progress) {
                    this.transfer_stats.update(this_ref.total_content_sent + sent_bytes, this_ref.total_content_size);
                    this_ref.callback_update_progress(file.name, file.size, this_ref.total_file_sent, this_ref.total_file_count, this_ref.total_content_sent + sent_bytes, this_ref.total_content_sent + file.size, this_ref.total_content_size, process_percent, this.transfer_stats.speed(), this.transfer_stats.remaining());
                }
            }, (file) => {
                this_ref.total_file_sent += 1;
                this.total_content_sent += file.size;
                this._filesystem.remove_file(file);
                delete this_ref._current_stream;
                this_ref._next();
            }, (file) => {
                this_ref.stop();
            })
        this._current_stream.go();
    }

    pause() {
        this.is_running = false;
        if (this._current_stream)
            this._current_stream.hold();
    }

    stop() {
        this.pause();
        delete this._current_stream;
        if (this.on_stop)
            this.on_stop()
    }
}

export {FilesystemUpload}