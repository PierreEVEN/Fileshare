import {spawn_context_action} from "./context_action";

const modal = document.getElementById('modal');
const modal_box = document.getElementById('modal-content');
const modal_content = document.getElementById('modal-content');

function close_modal() {
    modal.classList.remove('modal-open')
    modal.classList.add('modal-closed')
}

function open_modal(content, custom_width = '800px', custom_height = '300px') {
    modal.classList.remove('modal-closed')
    modal.classList.add('modal-open')

    modal_box.style.width = custom_width;
    modal_box.style.height = custom_height;
    modal_content.innerHTML = "";
    modal_content.append(content);
    return modal_content;
}

function is_opened() {
    return modal.classList.contains('modal-open')
}

window.modal = {open_modal, close_modal, is_opened}
export {open_modal, close_modal, is_opened}