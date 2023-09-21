import {selector} from "../../../common/tools/selector.js";
import {CURRENT_REPOS, permissions} from "../../../common/tools/utils";

const current_path = document.getElementById('current-path');
const tool_buttons = document.getElementById('viewport_toolbar');

async function update_dir(new_dir) {
    if (!new_dir || !current_path)
        return;

    current_path.innerHTML = '';

    if (tool_buttons) {
        tool_buttons.innerHTML = '';
        if ((new_dir && new_dir.parent && await permissions.can_user_upload_to_directory(new_dir.id)) || await permissions.can_user_upload_to_repos(CURRENT_REPOS.id)) {
            const upload_button = document.createElement('button');
            upload_button.onclick = () => upload.open_or_update_modal();
            upload_button.innerText = '+';
            upload_button.classList.add('plus-button')
            tool_buttons.append(upload_button);
        }

        const download_button = document.createElement('button');
        download_button.onclick = () => window.open('/archive/?repos=${session_data.selected_repos.access_key}&directory=' + (selector.get_current_directory() ? selector.get_current_directory().absolute_path() : ''), '_blank').focus();
        download_button.innerHTML = `<img src='/images/icons/icons8-download-96.png' alt='download'>`
        tool_buttons.append(download_button);

        if (await permissions.can_user_edit_repos(CURRENT_REPOS.id)) {
            const edit_button = document.createElement('button');
            edit_button.onclick = () => edit_repos.edit_repos(CURRENT_REPOS);
            edit_button.innerHTML = `<img src='/images/icons/icons8-edit-96.png' alt='modifier'>`;
            edit_button.classList.add('plus-button')
            tool_buttons.append(edit_button);
        }
    }

    const dirs = new_dir.parent_dirs();
    while (dirs.length > 0) {
        const dir = dirs.pop();


        if (dir.parent) {
            // Add separator between directories
            const separator = document.createElement('p')
            separator.innerText = '>'
            current_path.append(separator);
        }

        // Add button for each directory of the current path
        const button = document.createElement('button')
        button.innerText = dir.name;
        button.onclick = () => selector.set_current_dir(dir);
        current_path.append(button);
    }

    const full_path = new_dir.absolute_path();
    window.history.pushState(full_path, null, `${window.location.href.split('?')[0]}?repos=${CURRENT_REPOS.access_key}&directory=${full_path}`);
}

selector.on_changed_dir((new_dir, _) => update_dir(new_dir));
update_dir(selector.last_directory);
