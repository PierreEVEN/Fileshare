import {spawn_context_action} from "../../../common/widgets/context_action.js";
import {close_modal, open_modal} from "../../../common/widgets/modal.js";
import {print_message} from "../../../common/widgets/message_box.js";
import {update_repos_content} from "./repos_builder";
import {CURRENT_REPOS} from "../../../common/tools/utils";

const edit_dir_hbs = require('./edit_directory.hbs')
const edit_file_hbs = require('./edit_file.hbs')

function spawn_item_context_action(item) {
    spawn_context_action([{
        title: "Modifier",
        action: () => {
            if (item.is_directory)
                open_modal(edit_dir_hbs(item), '500px', '400px');
            else
                open_modal(edit_file_hbs(item), '500px', '400px');
        },
        image: '/images/icons/icons8-edit-96.png'
    }, {
        title: "Télécharger",
        action: () => {
            if (item.is_directory) {
                window.open(`/archive/?repos=${CURRENT_REPOS.access_key}&directory=${item.absolute_path()}`, '_blank').focus();
            } else
                window.open(`/file/?file=${item.id}`, '_blank').focus();
        },
        image: '/images/icons/icons8-download-96.png'
    }, {
        title: "Partager",
        action: async () => {
            let url;
            if (item.is_directory) {
                url = `${location.hostname}/repos/?repos=${CURRENT_REPOS.access_key}&directory=${item.absolute_path()}`;
            } else {
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
            confirm_button.onclick = async () => {
                if (item.is_file) {
                    const result = await fetch(`/file/delete/?file=${item.id}`, {method: 'POST'});
                    if (result.status === 200) {
                        item.remove();
                        print_message('info', `File removed`, `Successfully removed ${item.name}`);
                        close_modal();
                    } else if (result.status === 403) {
                        window.location = `/signin/`;
                    } else {
                        print_message('error', `Failed to remove ${item.name}`, result.status);
                        update_repos_content();
                        close_modal();
                    }
                } else if (item.is_directory) {
                    const result = await fetch(`/directory/delete/?directory=${item.id}`, {method: 'POST'});
                    if (result.status === 200) {
                        item.remove();
                        print_message('info', `Directory removed`, `Successfully removed ${item.name}`);
                        close_modal();
                    } else if (result.status === 403) {
                        window.location = `/signin/`;
                    } else {
                        print_message('error', `Failed to remove ${item.name}`, result.status);
                        update_repos_content();
                        close_modal();
                    }
                } else
                    print_message('error', 'Not handled', 'null');
            }
            div.append(confirm_button)
            open_modal(div, '500px', '100px');
        },
        image: '/images/icons/icons8-trash-52.png'
    }])
}

export {spawn_item_context_action}