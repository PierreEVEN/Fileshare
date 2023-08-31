import {close_modal, is_opened, open_modal} from '../widgets/modal.js'
import {humanFileSize, seconds_to_str} from "../utils.js";
import {picture_from_mime_type} from "./repos_builder/item.js";
import {Filesystem} from "../filesystem.js";
import {FilesystemUpload} from "../filesystem_upload.js";

const url = `/fileshare/repos/${current_repos.access_key}/upload`

let filesystem = new Filesystem(current_repos.name);
let filesystem_upload = new FilesystemUpload(filesystem, url);
let stop_process = false;

let add_file_button = null;
let cancel_upload = null;
let upload_button = null;
let global_status_div = null;
let global_progress_bar = null;
let global_status_text = null;


function add_file_to_upload(file, path) {
    if (!is_opened())
        open_upload_modal_for_files();

    file.full_path = path + '/' + file.name;
    filesystem.add_file(file, path ? path : '/');
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
    const gen_dir = (dir, parent_div) => {
        /* CONTAINER */
        const dir_div = document.createElement('div');
        dir_div.classList.add('folder');

        /* CONTENT */
        const dir_content = document.createElement('div');
        dir_content.classList.add('folder-content')
        dir_content.style.display = 'none';

        /* BUTTON */
        const dir_button = document.createElement('div');
        dir_button.classList.add('folder-button')

        /* NAME */
        const dir_title = document.createElement('h2');
        dir_button.append(dir_title);

        /* REMOVE BUTTON */
        const remove_dir_button = document.createElement('button');
        remove_dir_button.innerHTML = `<img src='/images/icons/icons8-trash-52.png' alt="supprimer">`
        remove_dir_button.classList.add('trash');
        remove_dir_button.classList.add('cancel-button');
        remove_dir_button.style.opacity = '0';
        remove_dir_button.onclick = () => dir.remove();

        dir_button.append(remove_dir_button);
        dir_button.onmouseenter = () => remove_dir_button.style.opacity = '1';
        dir_button.onmouseleave = () => remove_dir_button.style.opacity = '0';

        dir_div.append(dir_button);
        dir_div.append(dir_content);

        dir_button.onclick = () => {
            if (!dir_div.expanded) {
                dir_div.expanded = true;
                if (!dir_div.generate_content) {
                    dir_div.generate_content = true;
                    for (const child_dir of Object.values(dir.directories))
                        gen_dir(child_dir, dir_content);

                    for (const file of dir.files)
                        gen_file(file, dir_content);
                }
                dir_content.style.display = 'flex';
            } else {
                dir_div.expanded = false;
                dir_content.style.display = 'none';
            }
        }

        dir.callback_removed = () => dir_div.remove()
        dir.callback_directory_added = new_dir => {
            if (dir_div.generate_content)
                gen_dir(new_dir, dir_content);
        }
        dir.callback_file_added = new_file => {
            if (dir_div.generate_content)
                gen_file(new_file, dir_content);
        }
        dir.callback_stats_updated = (content_size, content_files) => dir_title.innerText = `${dir.name} (${humanFileSize(content_size)} - ${content_files} fichiers)`;
        dir.callback_stats_updated(dir.content_size, dir.content_files);

        parent_div.append(dir_div);
    }

    const gen_file = (file, parent_div) => {
        /* CONTAINER */
        const file_div = document.createElement('div');
        file_div.classList.add('file');
        file_div.append(picture_from_mime_type(URL.createObjectURL(file), file.mimetype))

        /* TITLE */
        const file_title = document.createElement('p');
        file_title.innerText = `${file.name} (${humanFileSize(file.size)})`;
        file_div.append(file_title);

        /* REMOVE BUTTON */
        const remove_file_button = document.createElement('button');
        remove_file_button.innerHTML = `<img src='/images/icons/icons8-trash-52.png' alt="supprimer">`
        remove_file_button.classList.add('trash');
        remove_file_button.classList.add('cancel-button');
        remove_file_button.style.opacity = '0';
        remove_file_button.onclick = () => filesystem.remove_file(file);
        file_div.append(remove_file_button);
        file_div.onmouseenter = () => remove_file_button.style.opacity = '1';
        file_div.onmouseleave = () => remove_file_button.style.opacity = '0';

        file.callback_removed = () => file_div.remove();

        parent_div.append(file_div);
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
            filesystem.root.callback_stats_updated = (content_size, content_files) => {
                if (content_files === 0)
                    title.innerText = 'Envoyer des fichiers';
                else
                    title.innerText = `${content_files} fichiers (${humanFileSize(content_size)})`;
            }

            filesystem.root.callback_file_added = (new_file) => gen_file(new_file, file_list_div)

            filesystem.root.callback_directory_added = (new_dir) => gen_dir(new_dir, file_list_div)
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
            cancel_upload.onclick = () => {
                close_modal()
            };
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

async function start_upload() {
    stop_process = false;
    add_file_button.style.display = "none";
    upload_button.style.display = "none";
    global_status_div.style.display = 'flex';
    cancel_upload.onclick = stop_upload;
    cancel_upload.value = "Arrêter";

    filesystem_upload.start();
}

function stop_upload() {
    add_file_button.style.display = "flex";
    upload_button.style.display = "flex";
    global_status_div.style.display = 'none';
    cancel_upload.value = "Annuler";
    cancel_upload.onclick = close_modal;
    stop_process = true;

    filesystem_upload.stop();
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
}
export {add_file_to_upload, open_or_update_modal, stop_upload, open_file_dialog, start_upload}