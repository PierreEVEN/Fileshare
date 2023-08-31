import {humanFileSize, print_message} from "./utils.js";

class FilesystemUpload {
    /**
     * @param filesystem {Filesystem}
     * @param url {string}
     */
    constructor(filesystem, url) {
        this.max_batch_size = 200 * 1024 * 1024; // 200Mo
        this.filesystem = filesystem;
        this.is_running = false;
        this.url = url;

        this.total_content_size = this.filesystem.root.content_size;
        this.total_content_sent = 0;

        this.upload_in_progress_data_sent = 0;

        this.total_file_count = this.filesystem.root.content_files;
        this.total_file_sent = 0;

        /* CALLBACKS */

        this._request = new XMLHttpRequest();
        this._byte_sent = 0;
        this._process_file_id = null;
        this._received_ack = true;
        const this_ref = this;
        this._request.onreadystatechange = () => {
            const is_quick = this_ref._request.status === 200 || this_ref._request.status === 202;
            if (this_ref._request.readyState === 2 && is_quick) { // message received (only for 202 and 200 response)
                if (this_ref._request.status === 202)
                    this_ref._receive_file_complete();
                else
                    this_ref._receive_chunk_ack();
            }
            if (this_ref._request.readyState === 4 && !is_quick) { // header received
                if (this_ref._request.status === 201)
                    this_ref._receive_file_id(this_ref._request.response);
                else
                    this_ref._received_error(this_ref._request.status, this_ref._request.response);
            }
        }

        this._request.upload.addEventListener("progress", (event) => {
            console.log('loaded', humanFileSize(event.loaded));
        });

    }

    start() {
        if (this.is_running)
            return;
        this.is_running = true;

        if (!this._received_ack)
            return;

        if (this.file_in_process)
            this._continue_current_file();
        else
            this._process_new_file();
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
    }

    _receive_file_id(file_id) {
        console.log('received file id :', file_id);

        if (this._received_ack)
            return;

        this._process_file_id = file_id;
        this._received_ack = true;
        if (this.is_running)
            this._continue_current_file();
    }

    _receive_chunk_ack() {
        console.log('received chunk ack');

        if (this._received_ack)
            return;

        this._received_ack = true;
        if (this.is_running)
            this._continue_current_file();
    }

    _receive_file_complete() {
        console.log('received file complete');

        if (this._received_ack)
            return;

        this._received_ack = true;

        if (this.file_in_process) {
            this.total_file_sent += 1;
            this.total_content_sent += this.file_in_process.size;
            this.filesystem.remove_file(this.file_in_process)
            this.file_in_process = null;
        }

        if (this.is_running)
            this._process_new_file();
    }

    _received_error(status, content) {
        this.stop();
        print_message('error', `An error occured durring the upload : ${status}\n`, content.toString());
        console.error('Error :\n', content);
    }

    _process_new_file() {
        if (!this._received_ack)
            print_message('error', 'Ack not received', 'Cannot send next chunk before the reception of the previous ack');

        this.upload_in_progress_data_sent = 0;

        this.file_in_process = this.filesystem.get_random_file();
        if (!this.file_in_process)
            return;

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
        this._byte_sent += this.max_batch_size;
    }

    _process_data(data) {
        this._request.open("POST", this.url);
        if (this._byte_sent === 0) {
            this._request.setRequestHeader('file_name', encodeURIComponent(this.file_in_process.name));
            this._request.setRequestHeader('file_size', this.file_in_process.size);
            this._request.setRequestHeader('mimetype', this.file_in_process.mimetype);
            this._request.setRequestHeader('virtual_path', encodeURIComponent(this.file_in_process.directory));
            this._request.setRequestHeader('description', encodeURIComponent(this.file_in_process.description));
        } else {
            this._request.setRequestHeader('file_id', this._process_file_id);
        }
        this._request.send(data);
        this._received_ack = false;
    }
}


export {FilesystemUpload}