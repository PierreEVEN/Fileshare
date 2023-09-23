import {humanFileSize, permissions} from "../../../common/tools/utils.js";
import * as handlebars from "handlebars";
import {get_mime_icon_path} from "../../../common/tools/mime_utils";
import {print_message} from "../../../common/widgets/message_box";
import {close_modal, open_modal} from "../../../common/widgets/modal";
import edit_dir_hbs from "./edit_directory.hbs";
import edit_file_hbs from "./edit_file.hbs";
import {update_repos_content} from "./repos_builder";

let opened_item_div = null;

function open_this_item(div, file) {
    import('../../../embed_viewers').then(async _ => {
        const ctx = {
            'close_item_plain': close_item_plain,
        };
        if (!opened_item_div) {
            opened_item_div = require('./item.hbs')({
                    item: file,
                    file_size: humanFileSize(file.size)
                },
                ctx);
            document.body.append(opened_item_div);
        } else {
            import('../../../embed_viewers/custom_elements/document/showdown_loader.js').then(showdown => {
                document.getElementById('item-title').innerText = file.name;
                document.getElementById('item-size').innerText = humanFileSize(file.size);
                document.getElementById('item-mime-type').innerText = file.mimetype;
                document.getElementById('item-description').innerHTML = file.description && file.description !== '' ? showdown.convert_text(file.description) : '';
                document.getElementById('item-content').innerHTML = handlebars.compile('{{item_image item}}')({item: file});
                document.getElementsByClassName('typeicon')[0].src = get_mime_icon_path(file.mimetype);
            })
        }
        const action_buttons = document.getElementById('file-action-buttons');
        action_buttons.innerHTML = '';

        const share = document.createElement('button');
        share.innerHTML = `<img src="/images/icons/icons8-url-96.png" alt="share">`
        share.classList.add('plus-button')
        share.onclick = async () => {
            await navigator.clipboard.writeText(`${location.hostname}/file/?file=${file.id}`);
            print_message('info', 'Lien copié dans le presse - papier', url)
        }
        action_buttons.append(share)

        const download = document.createElement('button');
        download.innerHTML = `<img src="/images/icons/icons8-download-96.png" alt="share">`
        download.onclick = async () => window.open(`/file/?file=${file.id}`, '_blank').focus();
        download.classList.add('plus-button')
        action_buttons.append(download)


        if (await permissions.can_user_edit_file(file.id)) {
            const edit_button = document.createElement('button');
            edit_button.innerHTML = `<img src="/images/icons/icons8-edit-96.png" alt="edit">`
            edit_button.onclick = async () => {
                close_item_plain();
                open_modal(edit_file_hbs(file));
            }
            edit_button.classList.add('plus-button')
            action_buttons.append(edit_button)

            const delete_button = document.createElement('button');
            delete_button.innerHTML = `<img src="/images/icons/icons8-trash-52.png" alt="delete">`
            delete_button.classList.add('plus-button')
            delete_button.onclick = async () => {
                close_item_plain();
                const div = document.createElement('div')
                const p = document.createElement('p')
                p.innerText = `Êtes vous sur de vouloir supprimer ${file.name}`;
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
                    const result = await fetch(`/file/delete/?file=${file.id}`, {method: 'POST'});
                    if (result.status === 200) {
                        file.remove();
                        print_message('info', `File removed`, `Successfully removed ${file.name}`);
                        close_modal();
                    } else if (result.status === 403) {
                        window.location = `/signin/`;
                    } else {
                        print_message('error', `Failed to remove ${file.name}`, result.status);
                        update_repos_content();
                        close_modal();
                    }
                }
                div.append(confirm_button)
                open_modal(div, '500px', '100px');
            }
            action_buttons.append(delete_button)
        }
    });
}

window.addEventListener('resize', _ => {
    if (opened_item_div) {
        opened_item_div.style.width = window.innerWidth + 'px';
        opened_item_div.style.height = window.innerHeight + 'px';
    }
})

function close_item_plain() {
    if (opened_item_div)
        opened_item_div.remove();
    opened_item_div = null;
}

function is_opened() {
    return !!opened_item_div;
}

export {open_this_item, is_opened, close_item_plain}