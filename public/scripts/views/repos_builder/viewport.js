import {is_opened} from "./item.js";
import {spawn_context_action} from "../../widgets/context_action.js";
import {close_modal, open_modal} from "../../widgets/modal.js";
import {print_message} from "../../widgets/message_box.js";

function spawn_item_context_action(item) {
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
            if (item.is_directory) {
                window.open(`/repos/archive/?repos={current_repos.access_key}&directory=${item.absolute_path()}`, '_blank').focus();
            }
            else
                window.open(`/file/?repos=${current_repos.access_key}`, '_blank').focus();
        },
        image: '/images/icons/icons8-download-96.png'
    }, {
        title: "Partager",
        action: async () => {
            let url;
            if (item.folders) {
                url = `${location.hostname}/repos/?repos=${current_repos.access_key}&directory=${item.absolute_path()}`;
            }
            else {
                url = `${location.hostname}/file/?file=${item.id}`;
            }
            await navigator.clipboard.writeText(url);
            print_message('info', 'Lien copié dans le presse - papier', url)
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

function gen_context_action(item) {
    const object_button = document.createElement('button');
    object_button.onclick = () => {
        spawn_item_context_action(item);
    }
    object_button.innerText = '...';
    object_button.classList.add('open-context-button')
    return object_button;
}

function is_item_opened() {
    return is_opened();
}

export {is_item_opened, gen_context_action, spawn_item_context_action}