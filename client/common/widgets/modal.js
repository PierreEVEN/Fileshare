const modal = document.getElementById('modal');
const modal_content = document.getElementById('modal-content');

function close_modal() {
    if (modal_content.on_close_modal)
        if (!modal_content.on_close_modal())
            return;
    modal.classList.remove('show')
}

function open_modal(content, custom_width = '800px', custom_height = '300px', modal_class= null) {
    modal_content.classList.remove(...modal_content.classList);
    modal.classList.add('show')

    modal_content.style.width = custom_width;
    modal_content.style.height = custom_height;
    modal_content.innerHTML = "";
    if (modal_class)
        modal_content.classList.add(modal_class)

    if (content.length)
        for (const item of content)
            modal_content.append(item);
    else
        modal_content.append(content);
    modal_content.on_close_modal = null;
    return modal_content;
}

function is_opened() {
    return modal.classList.contains('show')
}

window.modal = {open_modal, close_modal, is_opened}
export {open_modal, close_modal, is_opened}