import {gen_item, is_opened, open_this_item} from "./item.js";
import {select_element} from "../repos_builder.js";
import {spawn_context_action} from "../context_action.js";
import {close_modal, open_modal} from "../modal.js";
import {print_message} from "../utils.js";

const div_file_list = document.getElementById('file-list')

function gen_context_action(item) {

    const object_button = document.createElement('button');
    object_button.onclick = () => {
        spawn_context_action([{
            title: "Renommer",
            action: () => {
                const div = document.createElement('div')
                const edit_text = document.createElement('input')
                edit_text.type = 'text';
                edit_text.value = item.name;
                div.append(edit_text)
                const confirm_button = document.createElement('button')
                confirm_button.innerText = 'renommer';
                confirm_button.onclick = () => {
                    console.log('rename to ', edit_text.value)
                    close_modal();
                }
                div.append(confirm_button)
                open_modal(div, '500px', '100px');
            },
            image: '/images/icons/icons8-edit-96.png'
        }, {
            title: "Télécharger",
            action: () => {
                if (item.folders) {
                    console.log("Not handled yet")
                }
                else
                    window.open(`/fileshare/repos/${current_repos.access_key}/file/${item.id}`, '_blank').focus();
            },
            image: '/images/icons/icons8-download-96.png'
        }, {
            title: "Partager",
            action: async () => {
                if (item.folders) {
                    console.log("Not handled yet")
                }
                else {
                    const url = `${location.hostname}/fileshare/repos/${current_repos.access_key}/file/${item.id}`;
                    await navigator.clipboard.writeText(url);
                    print_message('info', 'Lien copié dans le clipboard', url)
                }
            },
            image: '/images/icons/icons8-url-96.png'
        }, {
            title: "Supprimer",
            action: () => {
                const div = document.createElement('div')
                const p = document.createElement('p')
                p.innerText = `Êtes vous sur de vouloir supprimer ${item.name}`;
                div.append(p)
                const no_button = document.createElement('button')
                no_button.classList.add('cancel-button')
                no_button.innerText = 'Non';
                no_button.onclick = () => {
                    close_modal();
                }
                div.append(no_button)
                const confirm_button = document.createElement('button')
                confirm_button.innerText = 'Oui';
                confirm_button.onclick = () => {
                    console.log("Not handled")
                }
                div.append(confirm_button)
                open_modal(div, '500px', '100px');
            },
            image: '/images/icons/icons8-trash-52.png'
        }
        ])


    }
    object_button.innerText = '...';
    object_button.classList.add('open-context-button')
    return object_button;
}

function show_folder_content(hierarchy, on_click_directory) {
    div_file_list.innerHTML = ''

    for (const folder of Object.values(hierarchy.folders)) {
        const object_button = document.createElement('div');
        object_button.onclick = (event) => {
            if (event.target.classList.contains('open-context-button'))
                return
            on_click_directory(folder);
        }
        object_button.classList.add('object-button')
        const div = document.createElement('div');
        div.classList.add('item-preview')
        div.classList.add('folder')
        div.innerHTML = `<img src="/images/icons/icons8-folder-96.png" alt="dossier">
                                 <p>${folder.name}</p>`;
        object_button.append(gen_context_action(folder));
        object_button.append(div)
        div_file_list.append(object_button);
        folder.div = object_button;
    }

    for (const file of hierarchy.files) {
        const url = '/fileshare/repos/' + current_repos.access_key + '/file/' + file.id;
        const object_button = document.createElement('div');
        object_button.onclick = (event) => {
            if (event.target.classList.contains('open-context-button'))
                return
            open_this_item(object_button, file);
            select_element(file);
        }
        object_button.classList.add('object-button')
        const div = document.createElement('div');
        div.classList.add('item-preview')
        div.append(gen_item(file.name, url, file.size, file.mimetype, true));
        object_button.append(gen_context_action(file));
        object_button.append(div);
        div_file_list.append(object_button);
        file.div = object_button;
    }
}

function is_item_opened() {
    return is_opened();
}

export {show_folder_content, is_item_opened}