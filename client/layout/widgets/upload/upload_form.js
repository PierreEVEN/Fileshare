import {close_modal, is_opened, open_modal} from '../../../common/widgets/modal.js'
import {humanFileSize, seconds_to_str} from "../../../common/tools/utils.js";
import {print_message} from "../../../common/widgets/message_box.js";
import {Filesystem} from "../../../common/tools/filesystem.js";
import {FilesystemUpload} from "../../../common/tools/filesystem_upload.js";
import {get_viewport_filesystem} from "../viewport/repos_builder.js";
import upload_hbs from "./upload.hbs";
import file_hbs from "./file.hbs";
import directory_hbs from "./directory.hbs";

const url = current_repos ? `/repos/upload/?repos=${current_repos.access_key}` : null;
let filesystem = current_repos ? new Filesystem(current_repos.name) : null;
const filesystem_upload = current_repos ? new FilesystemUpload(filesystem, url) : null;
let stop_process = false;

let add_file_button = null;
let cancel_upload = null;
let upload_button = null;
let global_status_div = null;
let global_status_text = null;

if (filesystem_upload) {
    filesystem_upload.callback_finished = () => {
        close_modal();
        print_message('info', 'Tache terminée', 'Mise en ligne des fichiers terminée avec succès.')
    }

    filesystem_upload.callback_file_uploaded = (file, file_id) => {
        get_viewport_filesystem().add_file({
            name: file.name,
            mimetype: file.mimetype,
            size: file.size,
            id: file_id
        }, file.directory.absolute_path());
    }
}

function add_file_to_upload(file, path) {
    if (!is_opened())
        open_upload_modal_for_files();
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
    filesystem.clear();
    const gen_dir = (dir, parent_div) => {
        const ctx = {};
        const directory = directory_hbs({item: dir}, ctx);
        const dir_content = directory.getElementsByClassName('folder-content')[0];
        ctx.enter = () => directory.getElementsByClassName('cancel-button')[0].style.opacity = '1';
        ctx.leave = () => directory.getElementsByClassName('cancel-button')[0].style.opacity = '0';
        ctx.clicked = () => {
            if (!dir_content.expanded) {
                dir_content.expanded = true;
                if (!dir_content.generate_content) {
                    dir_content.generate_content = true;
                    for (const child_dir of Object.values(dir.directories))
                        gen_dir(child_dir, dir_content);

                    for (const file of dir.files)
                        gen_file(file, dir_content);
                }
                dir_content.style.display = 'flex';
            } else {
                dir_content.expanded = false;
                dir_content.style.display = 'none';
            }
        }
        ctx.removed = () => dir.remove();

        const title = directory.getElementsByTagName('h2')[0];
        dir.callback_stats_updated = (content_size, content_files) => title.innerText = `${dir.name} (${humanFileSize(content_size)} - ${content_files} fichiers)`;
        dir.callback_stats_updated(dir.content_size, dir.content_files);
        dir.callback_directory_added = new_dir => {
            if (dir_content.generate_content)
                gen_dir(new_dir, dir_content);
        }
        dir.callback_file_added = new_file => {
            if (dir_content.generate_content)
                gen_file(new_file, dir_content);
        }

        dir.callback_removed = () => directory.remove();
        parent_div.append(directory);
    }

    const gen_file = (file, parent_div) => {
        const ctx = {};
        const file_dom = file_hbs({item: file, name:file.name, size: humanFileSize(file.size)}, ctx);
        ctx.removed = () => filesystem.remove_file(file);
        ctx.enter = () => file_dom.getElementsByClassName('cancel-button')[0].style.opacity = '1';
        ctx.leave = () => file_dom.getElementsByClassName('cancel-button')[0].style.opacity = '0';

        file.callback_removed = () => file_dom.remove();
        parent_div.append(file_dom);
    }

    const modal_parent = open_modal(upload_hbs({}, {
        send: start_upload,
        pause: (button) => {
            if (button.paused) {
                button.paused = false;
                button.firstChild.src = '/images/icons/icons8-pause-30.png';
                filesystem_upload.start();
            } else {
                button.paused = true;
                button.firstChild.src = '/images/icons/icons8-play-64.png';
                filesystem_upload.pause();
            }
        }
    }), '80vw', '90vh', 'upload');

    const title = modal_parent.getElementsByTagName('h1')[0];
    const container = modal_parent.getElementsByClassName('file-list-box')[0];
    const global_progress_bar = modal_parent.getElementsByClassName('progress-bar')[0];
    add_file_button = modal_parent.getElementsByClassName('plus-button')[0];
    upload_button = modal_parent.getElementsByClassName('confirm-button')[0];
    cancel_upload = modal_parent.getElementsByClassName('cancel-button')[0];
    global_status_div = modal_parent.getElementsByClassName('global-status')[0];
    global_status_text = global_status_div.getElementsByTagName('p')[0];
    filesystem.root.callback_stats_updated = (content_size, content_files) => title.innerText = content_files === 0 ? 'Envoyer des fichiers' : title.innerText = `${content_files} fichiers (${humanFileSize(content_size)})`;
    filesystem.root.callback_file_added = (new_file) => gen_file(new_file, container);
    filesystem.root.callback_directory_added = (new_dir) => gen_dir(new_dir, container);
    filesystem_upload.callback_file_state_changed = null;
    filesystem_upload.callback_global_state_changed = (progress, total, speed, remaining) => {
        global_progress_bar.style.width = `${progress / total * 100}%`;
        global_status_text.innerText = `${Math.round(progress / total * 100)}% (${humanFileSize(progress)} / ${humanFileSize(total)}) - ${humanFileSize(speed)}/s (~${seconds_to_str(remaining)})\n${filesystem_upload.file_in_process ? filesystem_upload.file_in_process.name : ''}`;
    }
    modal_parent.on_close_modal = () => {
        if (filesystem_upload.is_running) {
            filesystem_upload.pause();
            if (confirm('Un transfert est en cours, êtes vous sur de l\'interrompre ?')) {
                filesystem_upload.stop();
                filesystem.clear();
                return true;
            }
            filesystem_upload.start();
            return false;
        }
        return true;
    }
}

async function start_upload() {
    stop_process = false;
    add_file_button.style.display = "none";
    upload_button.style.display = "none";
    global_status_div.style.display = 'flex';
    cancel_upload.onclick = stop_upload;
    cancel_upload.value = "Arrêter";
    const button = global_status_div.getElementsByTagName('button')[0];
    button.paused = false;
    button.firstChild.src = '/images/icons/icons8-pause-30.png';

    filesystem_upload.start();
}

function stop_upload() {
    add_file_button.style.display = "block";
    upload_button.style.display = "block";
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

window.upload = {add_file_to_upload, open_file_dialog, start_upload, stop_upload, open_or_update_modal}
export {add_file_to_upload, open_or_update_modal, stop_upload, open_file_dialog, start_upload}