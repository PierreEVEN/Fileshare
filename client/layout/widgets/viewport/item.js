import {humanFileSize, PAGE_CONTEXT, permissions} from "../../../common/tools/utils.js";
import * as handlebars from "handlebars";
import {get_mime_icon_path} from "../../../common/tools/mime_utils";
import {print_message} from "../../../common/widgets/message_box";
import {close_modal, open_modal} from "../../../common/widgets/modal";
import edit_file_hbs from "./edit_file.hbs";
import {select_next_element, select_previous_element, update_repos_content} from "./repos_builder";

let opened_item_div = null;
let overlay = null;
let last_item = null;

function open_this_item(div, file) {
    if (last_item === file)
        return;
    last_item = file;
    if ((document.fullScreenElement && document.fullScreenElement !== null) ||
        (!document.mozFullScreen && !document.webkitIsFullScreen)) {
        if (document.documentElement.requestFullScreen) {
            document.documentElement.requestFullScreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullScreen) {
            document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    }

    import('../../../embed_viewers').then(async _ => {
        const ctx = {
            'close_item_plain': close_item_plain,
            'show_previous_item': select_previous_element,
            'show_next_item': select_next_element,
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
        overlay = document.getElementById('file-overlay');

        const action_buttons = document.getElementById('file-action-buttons');
        action_buttons.innerHTML = '';

        const share = document.createElement('button');
        share.innerHTML = `<img src="/images/icons/icons8-url-96.png" alt="share">`
        share.classList.add('plus-button')
        share.onclick = async () => {
            await navigator.clipboard.writeText(`${location.host}${PAGE_CONTEXT.repos_path()}/file/${file.id}`);
            print_message('info', 'Lien copié dans le presse - papier', await navigator.clipboard.readText())
        }
        action_buttons.append(share)

        const download = document.createElement('button');
        download.innerHTML = `<img src="/images/icons/icons8-download-96.png" alt="share">`
        download.onclick = async () => window.open(`${PAGE_CONTEXT.repos_path()}/file/${file.id}`, '_blank').focus();
        download.classList.add('plus-button')
        action_buttons.append(download)

        if (await permissions.can_user_edit_item(PAGE_CONTEXT.repos_path(), file.id)) {
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
                        window.location = `/auth/signin/`;
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

let hide_overlay_timeout = null;

function show_overlay(time) {
    if (!overlay)
        return;
    overlay.classList.add('overlay-displayed');
    overlay.classList.remove('overlay-hidden');
    if (hide_overlay_timeout)
        clearTimeout(hide_overlay_timeout);
    hide_overlay_timeout = setTimeout(() => {
        if (!overlay)
            return;
        overlay.classList.remove('overlay-displayed');
        overlay.classList.add('overlay-hidden');
    }, time)
}

window.addEventListener('mousemove', _ => show_overlay(500));
window.addEventListener('click', _ => show_overlay(2000));

let touchstartX = 0
let touchendX = 0
let touchstartY = 0
let touchendY = 0

function checkDirection() {
    let changed = false;
    if (touchendY < touchstartY - window.screen.height / 4 || touchendY > touchstartY + window.screen.height / 4) {
        close_item_plain();
        changed = true;
    } else {
        if (touchendX < touchstartX - window.screen.width / 5) {
            select_previous_element();
            changed = true;
        }
        if (touchendX > touchstartX + window.screen.width / 5) {
            select_next_element();
            changed = true;
        }
    }
    if (changed) {
        touchstartX = touchendX;
        touchstartY = touchendY;
    }
}

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX
    touchstartY = e.changedTouches[0].screenY
})

document.addEventListener('touchmove', e => {

    touchendX = e.changedTouches[0].screenX
    touchendY = e.changedTouches[0].screenY
    if (e.changedTouches.length > 1) {
        touchstartX = touchendX;
        touchstartY = touchendY;
        return;
    }
    checkDirection()
})

window.addEventListener('resize', _ => {
    if (opened_item_div) {
        opened_item_div.style.width = window.innerWidth + 'px';
        opened_item_div.style.height = window.innerHeight + 'px';
    }
})

function close_item_plain() {
    last_item = null;
    if (opened_item_div)
        opened_item_div.remove();
    opened_item_div = null;

    if (!(document.fullScreenElement || (!document.mozFullScreen && !document.webkitIsFullScreen))) {
        if (document.cancelFullScreen) {
            document.cancelFullScreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        }
    }
}

function is_opened() {
    return !!opened_item_div;
}

export {open_this_item, is_opened, close_item_plain}