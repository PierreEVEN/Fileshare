import {selector} from "../../../common/tools/selector.js";
import {PAGE_CONTEXT, humanFileSize, permissions} from "../../../common/tools/utils";

const current_path = document.getElementById('current-path');
const tool_buttons = document.getElementById('viewport_toolbar');

class PathBuilder {
    /**
     * @param filesystem {Filesystem}
     */
    constructor(filesystem) {
        this.filesystem = filesystem;

        const self = this;
        selector.on_changed_dir(async function (new_dir)  {
            await self.update_dir(new_dir)
        })
    }

    async update_dir(dir_id) {
        if (!current_path)
            return;

        current_path.innerHTML = '';

        if (tool_buttons) {
            tool_buttons.innerHTML = '';

            const dir_size = document.createElement('p');
            dir_size.innerText = "TODO : fix file size"; //`${humanFileSize(dir_data.content_size)} / ${dir_data.content_files} fichiers`
            tool_buttons.append(dir_size)

            if ((await permissions.can_user_upload_to_item(PAGE_CONTEXT.repos_path(), dir_id)) || await permissions.can_user_upload_to_repos(PAGE_CONTEXT.repos_path())) {
                const upload_button = document.createElement('button');
                upload_button.onclick = () => upload.open_or_update_modal();
                upload_button.innerText = '+';
                upload_button.classList.add('plus-button')
                tool_buttons.append(upload_button);
            }

            const download_button = document.createElement('button');
            download_button.onclick = () => window.open(`${PAGE_CONTEXT.repos_path()}/download` + (selector.get_current_directory() ? selector.get_current_directory().absolute_path() : '/'), '_blank').focus();
            download_button.innerHTML = `<img src='/images/icons/icons8-download-96.png' alt='download'>`
            tool_buttons.append(download_button);

            if (await permissions.can_user_edit_repos(PAGE_CONTEXT.repos_path())) {
                const edit_button = document.createElement('button');
                edit_button.onclick = () => edit_repos.edit_repos(PAGE_CONTEXT.display_repos);
                edit_button.innerHTML = `<img src='/images/icons/icons8-edit-96.png' alt='modifier'>`;
                edit_button.classList.add('plus-button')
                tool_buttons.append(edit_button);
            }
        }

        const button = document.createElement('button')
        button.innerText = this.filesystem.name;
        button.onclick = () => {
            selector.set_current_dir(null);
        }
        current_path.append(button);

        const separator = document.createElement('p')
        separator.innerText = ':'
        current_path.append(separator);

        let full_path_string = "/";
        for (const dir of this.filesystem.make_path_to_object(dir_id)) {
            const dir_data = this.filesystem.get_object_data(dir);

            if (dir_data.parent_item) {
                // Add separator between directories
                const separator = document.createElement('p')
                separator.innerText = '>'
                current_path.append(separator);
            }

            // Add button for each directory of the current path
            const button = document.createElement('button')
            button.innerText = dir_data.name;
            button.onclick = () => {
                selector.set_current_dir(dir);
            }
            current_path.append(button);
            full_path_string += dir_data.name + "/";
        }

        window.history.pushState(full_path_string, null, `${PAGE_CONTEXT.repos_path()}/tree${full_path_string}`);
    }
}

export {PathBuilder}
