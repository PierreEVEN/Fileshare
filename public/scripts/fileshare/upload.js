import {close_modal, open_modal} from './modal.js'
import {humanFileSize, seconds_to_str} from "./utils.js";

let files_to_upload = new Map();

function add_file_to_upload(file, path) {
    files_to_upload.set(file.name, file);
    open_or_update_modal();
}

let open_upload_modal_timeout = null;
function open_or_update_modal() {
    if (open_upload_modal_timeout)
        clearTimeout(open_upload_modal_timeout);
    open_upload_modal_timeout = setTimeout(() => {
        open_upload_modal_for_files(files_to_upload);
        open_upload_modal_timeout = null;
    }, 100);
}

function open_upload_modal_for_files(files) {
    files_to_upload = files;
    const send_files = document.createElement('div')
    send_files.classList.add('login')

    let files_code = ''
    for (const value of files_to_upload.values()) {
        files_code += `
                <div class="file-item">
                    <div class="left-fields">
                        <div>
                            <p>Titre</p>
                            <input class="item-title" type="text" value="${value.name}"></p>
                        </div>
                        <div>
                            <textarea class="item-description" placeholder="Description"></textarea>
                        </div>
                    </div>
                    <div class="right-fields">
                        <button onclick="console.log('suppr les items depuis ici')">
                            <img src="/images/icons/icons8-trash-52.png" alt="Trash icon">
                        </button>
                        <p>${humanFileSize(value.size)}</p>
                    </div>
                </div>
                `
    }

    send_files.innerHTML = `
            <h1>Envoyer des fichiers</h1>
            <div class="upload-file-list">
            ${files_code}
            </div>
            <div class="progress-container">
                <div id="progress-bar"></div>
            </div>
            <p id="progress-text"></p>
            <div class="send-buttons">
                <input type="button" class="add-file-button" value="+" onclick="module.upload.open_file_dialog()">
                <button class="cancel-button" onclick="module.upload.cancel_upload();">Annuler</button>
                <button onclick="module.upload.upload_files()">Envoyer</button>
            </div>
            `
    open_modal(send_files, '500px', '80%');
}

let progress = document.getElementById('progress-bar')
let progress_text = document.getElementById('progress-text')
let last_request = null;
let deltas = []
let last_file_upload_measure = null

function cancel_upload() {
    files_to_upload = new Map();
    close_modal();
    reset_all();
}

function upload_files() {

    progress = document.getElementById('progress-bar')
    progress_text = document.getElementById('progress-text')
    cancel_upload()

    const req = new XMLHttpRequest();
    req.upload.addEventListener("progress", updateProgress);
    req.open("POST", `/fileshare/repos/${current_repos.access_key}/upload`);
    const form = new FormData();
    for (const file of files_to_upload.values()) {
        form.append("file" + file.name, file, file.name);
        form.append("metadata_file" + file.name, JSON.stringify({
            virtual_path: file.virtual_path,
            description: "Pas de description",
            mimetype: file.mimetype ? file.mimetype : file.type
        }));
    }

    last_request = req;
    last_file_upload_measure = {size: 0, timestamp: performance.now()}
    req.onreadystatechange = function () {
        if (this.readyState === this.DONE) {
            window.location.href = this.responseURL;
        }
    };
    req.send(form);
}

function updateProgress(e) {

    let mean_speed = 0;
    if (last_file_upload_measure) {
        const time_delta = (performance.now() - last_file_upload_measure.timestamp) / 1000;
        const size_delta = e.loaded - last_file_upload_measure.size;

        deltas.push(size_delta / time_delta)


        last_file_upload_measure.size = e.loaded;
        last_file_upload_measure.timestamp = performance.now();

        if (deltas.length > 20) {
            deltas.splice(0, 1);
        }

        for (const delta of deltas)
            mean_speed += delta;
        mean_speed /= deltas.length
    }

    const remaining = (e.total - e.loaded) / mean_speed

    progress_text.innerText = `${Math.round(e.loaded / e.total * 100)}% (${humanFileSize(e.loaded)} / ${humanFileSize(e.total)}) - ${humanFileSize(mean_speed)}/s (~${seconds_to_str(remaining)})`
    progress.style.width = (((e.loaded / e.total) * 100)) + "%";
}

function reset_all() {

    if (last_request)
        last_request.abort();
    last_request = null;
    deltas = [];
    last_file_upload_measure = null;
    if (progress_text)
        progress_text.innerText = '';
    if (progress)
        progress.style.width = '0%';
}

function open_file_dialog() {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.multiple = true;
    inputElement.addEventListener("change", (e) => {
        for (const file of e.target.files)
            files_to_upload.set(file.name, file);

        open_or_update_modal();
    })
    inputElement.dispatchEvent(new MouseEvent("click"));
}

module.upload = {add_file_to_upload, open_or_update_modal, cancel_upload, open_file_dialog, upload_files}
export {add_file_to_upload, open_or_update_modal, cancel_upload, open_file_dialog, upload_files}