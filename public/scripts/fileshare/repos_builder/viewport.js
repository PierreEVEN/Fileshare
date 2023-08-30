import {gen_item, is_opened, open_this_item} from "./item.js";
import {select_element} from "../repos_builder.js";

const div_file_list = document.getElementById('file-list')

function show_folder_content(hierarchy, on_click_directory) {
    div_file_list.innerHTML = ''

    for (const folder of Object.values(hierarchy.folders)) {
        const object_button = document.createElement('div');
        object_button.onclick = () => on_click_directory(folder);
        object_button.classList.add('object-button')
        const div = document.createElement('div');
        div.classList.add('item-preview')
        div.classList.add('folder')
        div.innerHTML = `<img src="/images/icons/icons8-folder-96.png" alt="dossier">
                                 <p>${folder.name}</p>`;
        object_button.append(div)
        div_file_list.append(object_button);
        folder.div = object_button;
    }

    for (const file of hierarchy.files) {
        const url = '/fileshare/repos/' + current_repos.access_key + '/file/' + file.id;
        const object_button = document.createElement('div');
        object_button.onclick = () => {
            open_this_item(object_button, file);
            select_element(file);
        }
        object_button.classList.add('object-button')
        const div = document.createElement('div');
        div.classList.add('item-preview')
        div.append(gen_item(file.name, url, file.size, file.mimetype, true));
        object_button.append(div);
        div_file_list.append(object_button);
        file.div = object_button;
    }
}


function is_item_opened() {
    return is_opened();
}

export {show_folder_content, is_item_opened}