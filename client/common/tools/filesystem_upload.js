import {print_message} from "../widgets/message_box.js";
import {CURRENT_REPOS} from "./utils";

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
        const added = sent - this.last_sent;
        const elapsed = performance.now() - this.timestamp;
        this.timestamp = performance.now();
        const local_speed = added / elapsed * 1000;
        this.speed_measures.push(local_speed);
        this.total = total;
        this.last_sent = sent;
    }
}

class FilesystemUpload {
    /**
     * @param filesystem {Filesystem}
     * @param url {string}
     */
    constructor(filesystem, url) {
        this.max_batch_size = 50 * 1024 * 1024; // 200Mo
        this.filesystem = filesystem;
        this.is_running = false;
        this.url = url;

        this.total_content_size = this.filesystem.root.content_size;
        this.total_content_sent = 0;
        this.upload_in_progress_data_sent = 0;

        this['total_file_count'] = this.filesystem.root.content_files;
        this['total_file_sent'] = 0;

        /* CALLBACKS */
        this.callback_global_state_changed = null;
        this.callback_file_state_changed = null;
        this.callback_finished = null;
        this.callback_file_uploaded = null;

        this._request = new XMLHttpRequest();
        this._byte_sent = 0;
        this._process_file_id = null;
        this._received_ack = true;
        const this_ref = this;
        this._request.onreadystatechange = () => {
            const is_quick = this_ref._request.status === 200;
            if (this_ref._request.readyState === 2 && is_quick) { // message received (only for 202 and 200 response)
                this_ref._receive_chunk_ack();
            }
            if (this_ref._request.readyState === 4 && !is_quick) { // header received
                if (this_ref._request.status === 201)
                    this_ref._receive_file_id(this_ref._request.response);
                else if (this_ref._request.status === 202)
                    this_ref._receive_file_complete(this_ref._request.response === '' ? null : this_ref._request.response);
                else
                    this_ref._received_error(this_ref._request.status, this_ref._request.response);
            }
        }

        this._request.upload.addEventListener("progress", (event) => {
            this.upload_in_progress_data_sent = event.loaded;

            const total_sent = this_ref.total_content_sent + this_ref.upload_in_progress_data_sent + (this_ref._byte_sent ? this_ref._byte_sent : 0);

            this.transfer_stats.update(total_sent, this_ref.total_content_size);

            if (this_ref.callback_global_state_changed)
                this_ref.callback_global_state_changed(total_sent, this_ref.total_content_size, this.transfer_stats.speed(), this.transfer_stats.remaining());
            if (this_ref.callback_file_state_changed)
                this_ref.callback_file_state_changed(this_ref.file_in_process + this_ref._byte_sent, this_ref.upload_in_progress_data_sent);
        });

    }

    start() {
        if (this.is_running)
            return;

        this.transfer_stats = new TransferStats();
        this.is_running = true;
        if (!this._received_ack)
            return;

        if (this.file_in_process)
            this._continue_current_file();
        else {
            this.total_content_sent = 0;
            this.total_content_size = this.filesystem.root.content_size;

            this._process_new_file();
        }
    }

    pause() {
        this.is_running = false;
    }

    stop() {
        this.pause();
        this._received_ack = true;
        this._byte_sent = 0;
        this._process_file_id = null
        this.file_in_process = null;
        this._request.abort();
    }

    _receive_file_id(file_id) {
        console.info('received file id :', file_id);

        if (this._received_ack)
            return;

        this._byte_sent += this.max_batch_size;
        this._process_file_id = file_id;
        this._received_ack = true;
        if (this.is_running)
            this._continue_current_file();
    }

    _receive_chunk_ack() {
        console.info(`received chunk ack`);

        if (this._received_ack || !this._byte_sent)
            return;

        this._byte_sent += this.max_batch_size;

        this._received_ack = true;
        if (this.is_running)
            this._continue_current_file();
    }

    _receive_file_complete(file_id) {
        console.info(`received file complete : ${file_id}`);

        if (this._received_ack)
            return;

        this._received_ack = true;

        if (this.file_in_process) {
            this.total_file_sent += 1;
            this.total_content_sent += this.file_in_process.size;
            this.upload_in_progress_data_sent = 0;
            if (this.callback_file_uploaded && file_id)
                this.callback_file_uploaded(this.file_in_process, file_id);
            this.filesystem.remove_file(this.file_in_process);
            this.file_in_process = null;
        }

        if (this.is_running)
            this._process_new_file();
    }

    _received_error(status, content) {
        this.stop();

        if (status === 403) {
            window.location = `/repos/upload/?repos=${CURRENT_REPOS.access_key}`
        }

        print_message('error', `Upload error for ${this.file_in_process ? this.file_in_process.name : 'undefined'} (${status})`, content.toString());
        console.error('Error :\n', content);
    }

    _process_new_file() {
        if (!this._received_ack)
            print_message('error', 'Ack not received', 'Cannot send next chunk before the reception of the previous ack');

        this.upload_in_progress_data_sent = 0;

        this.file_in_process = this.filesystem.get_random_file();
        if (!this.file_in_process) {
            this.stop();
            if (this.callback_finished)
                this.callback_finished();
            return;
        }

        this._byte_sent = 0;
        this._process_data(this.file_in_process.slice(0, Math.min(this.file_in_process.size, this.max_batch_size)));
    }

    _continue_current_file() {
        if (!this._received_ack)
            print_message('error', 'Ack not received', 'Cannot send next chunk before the reception of the previous ack');

        if (!this.file_in_process || !this._byte_sent)
            return;

        const new_end = Math.min(this.file_in_process.size, this._byte_sent + this.max_batch_size);
        this._process_data(this.file_in_process.slice(this._byte_sent, new_end));
    }

    _process_data(data) {
        this._request.open("POST", this.url);
        if (this._byte_sent === 0) {
            this._request.setRequestHeader('name', encodeURIComponent(this.file_in_process.name));
            this._request.setRequestHeader('octets', this.file_in_process.size);
            this._request.setRequestHeader('mimetype', this.file_in_process.mimetype);
            this._request.setRequestHeader('virtual_path', encodeURIComponent(this.file_in_process.directory.absolute_path()));
            if (this.file_in_process.description)
                this._request.setRequestHeader('description', this.file_in_process.description ? encodeURIComponent(this.file_in_process.description) : '');
        } else {
            this._request.setRequestHeader('file_id', this._process_file_id);
        }
        this._request.send(data);
        this._received_ack = false;
    }
}


export {FilesystemUpload}