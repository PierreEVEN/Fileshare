import {close_modal, open_modal} from './modal.js'
import {humanFileSize, seconds_to_str} from "./utils.js";
import {Batch} from "./upload/batch.js";
import {upload_batch} from "./upload/batch_upload.js";
import {picture_from_mime_type} from "./repos_builder/item.js";

let files_to_upload = new Batch();
let stop_process = false;

let add_file_button = null;
let cancel_upload = null;
let upload_button = null;
let global_status_div = null;
let global_progress_bar = null;
let global_status_text = null;


function add_file_to_upload(file, path) {
    file.full_path = path + '/' + file.name;
    files_to_upload.add_file(file, path);
    open_or_update_modal();
}

let open_upload_modal_timeout = null;

function open_or_update_modal() {
    if (open_upload_modal_timeout)
        clearTimeout(open_upload_modal_timeout);
    open_upload_modal_timeout = setTimeout(() => {
        open_upload_modal_for_files();
        open_upload_modal_timeout = null;
    }, 100);
}

function open_upload_modal_for_files() {

    const gen_folder = (folder) => {
        const elements = []
        for (const entry of Object.values(folder.folders)) {
            const folder_div = document.createElement('div');
            folder_div.classList.add('folder');
            {
                const folder_content = document.createElement('div');
                folder_content.classList.add('folder-content')
                folder_content.style.display = 'none';

                const folder_button = document.createElement('div');
                folder_button.classList.add('folder-button')
                {
                    const folder_title = document.createElement('h2');
                    folder_title.innerText = `${entry.name} (${humanFileSize(entry.size)} - ${entry.total_files} fichiers)`;
                    folder_button.append(folder_title);

                    const remove_folder = document.createElement('button');
                    remove_folder.innerHTML = `<img src='/images/icons/icons8-trash-52.png' alt="supprimer">`
                    remove_folder.classList.add('trash');
                    remove_folder.classList.add('cancel-button');
                    remove_folder.style.opacity = '0';
                    remove_folder.onclick = () => {
                        delete folder.folders[entry.name];
                        folder_div.remove();
                    }
                    folder_button.append(remove_folder);
                    folder_button.onmouseenter = () => remove_folder.style.opacity = '1';
                    folder_button.onmouseleave = () => remove_folder.style.opacity = '0';

                    folder_button.onclick = () => {
                        if (folder_content.style.display === 'none') {
                            if (!folder_content.generated) {
                                folder_content.generated = true;
                                for (const element of gen_folder(entry))
                                    folder_content.append(element);
                            }
                            folder_content.style.display = 'flex';
                        } else {
                            folder_content.style.display = 'none';
                        }
                    }
                }
                folder_div.append(folder_button);
                folder_div.append(folder_content);
            }
            elements.push(folder_div);
        }
        for (const file of folder.files) {
            const file_div = document.createElement('div');
            file_div.classList.add('file');
            {
                file_div.append(picture_from_mime_type(URL.createObjectURL(file), file.mimetype))

                const file_title = document.createElement('p');
                file_title.innerText = `${file.name} (${humanFileSize(file.size)})`;
                file_div.append(file_title);

                const remove_folder = document.createElement('button');
                remove_folder.innerHTML = `<img src='/images/icons/icons8-trash-52.png' alt="supprimer">`
                remove_folder.classList.add('trash');
                remove_folder.classList.add('cancel-button');
                remove_folder.style.opacity = '0';

                remove_folder.onclick = () => {
                    delete folder.files[file.name];
                    file_div.remove();
                }
                file_div.append(remove_folder);
                file_div.onmouseenter = () => remove_folder.style.opacity = '1';
                file_div.onmouseleave = () => remove_folder.style.opacity = '0';

            }
            elements.push(file_div);
        }
        return elements;
    }


    const container_div = document.createElement('div');
    container_div.classList.add('modal-content');
    {
        const title = document.createElement('h1');
        title.innerText = "Envoyer des fichiers";
        container_div.append(title);

        const file_list_div = document.createElement('div');
        file_list_div.classList.add('file-list-box');
        {
            for (const element of gen_folder(files_to_upload.root))
                file_list_div.append(element);
        }
        container_div.append(file_list_div);

        const button_buttons = document.createElement('div');
        button_buttons.classList.add('bottom-buttons');
        {
            add_file_button = document.createElement('input');
            add_file_button.type = 'button';
            add_file_button.classList.add('plus-button');
            add_file_button.value = '+';
            add_file_button.onclick = open_file_dialog;
            button_buttons.append(add_file_button);

            cancel_upload = document.createElement('input');
            cancel_upload.type = 'button';
            cancel_upload.classList.add('cancel-button');
            cancel_upload.value = 'Annuler';
            cancel_upload.onclick = close_modal;
            button_buttons.append(cancel_upload);

            upload_button = document.createElement('input');
            upload_button.type = 'button';
            upload_button.classList.add('confirm-button');
            upload_button.value = 'Envoyer';
            upload_button.onclick = start_upload;
            button_buttons.append(upload_button);

            global_status_div = document.createElement('div')
            global_status_div.style.display = 'none';
            global_status_div.classList.add('global-status')
            global_status_div.classList.add('progress-container')
            {
                global_status_text = document.createElement('p');
                global_status_text.innerText = '1% (3.4Mo / 2.5Go) - 2.4Mo/s (~12 minutes)';
                global_status_div.append(global_status_text);

                global_progress_bar = document.createElement('div')
                global_progress_bar.classList.add('progress-bar')
                global_status_div.append(global_progress_bar);
            }
            button_buttons.append(global_status_div);
        }
        container_div.append(button_buttons);
    }
    open_modal(container_div, '500px', '95vh');
}

function stop_upload() {
    add_file_button.style.display = "flex";
    upload_button.style.display = "flex";
    global_status_div.style.display = 'none';
    cancel_upload.value = "Annuler";
    cancel_upload.onclick = close_modal;
    stop_process = true;
}

async function start_upload() {
    stop_process = false;
    add_file_button.style.display = "none";
    upload_button.style.display = "none";
    global_status_div.style.display = 'flex';
    cancel_upload.onclick = stop_upload;
    cancel_upload.value = "Arrêter";

    const total_to_upload = files_to_upload.root.size;
    let current_total = 0;
    let progress_bares = new Map();

    let batch = null;
    do {
        batch = files_to_upload.pop_next_content();
        await upload_batch(batch, (file, progress) => {

            if (!progress_bares[file.full_path]) {
                progress_bares[file.full_path] = {
                    last_progress: 0,
                }
            }

            let delta = progress - progress_bares[file.full_path].last_progress;
            progress_bares[file.full_path].last_progress = progress;

            current_total += delta;

            global_progress_bar.style.width = `${current_total / total_to_upload * 100}%`;
            global_status_text.innerText = `${file.name} : ${humanFileSize(current_total)} / ${humanFileSize(total_to_upload)} : ${Math.round(current_total / total_to_upload * 100)}%`;
        });
    } while (batch.length > 0 && !stop_process);
    stop_upload();
}

function open_file_dialog() {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    //inputElement.webkitdirectory = true;
    //inputElement.directory = true;
    inputElement.multiple = true;
    inputElement.addEventListener("change", (e) => {
        for (const file of e.target.files) {
            const path = (file.webkitRelativePath ? file.webkitRelativePath : '').split('/');
            path.pop();
            add_file_to_upload(file, path.length > 0 ? path.join('/') : '')
        }
    })
    inputElement.dispatchEvent(new MouseEvent("click"));
}

module.upload = {
    add_file_to_upload,
    open_or_update_modal,
    cancel_upload: stop_upload,
    open_file_dialog,
    upload_files: start_upload
}
export {add_file_to_upload, open_or_update_modal, stop_upload, open_file_dialog, start_upload}