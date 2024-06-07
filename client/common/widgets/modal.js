const modal = document.getElementById('modal');
const modal_content = document.getElementById('modal-content');

function close_modal() {
    if (modal_content.on_close_modal)
        if (!modal_content.on_close_modal())
            return;
    modal.classList.remove('show')
}

/**
 * @param content
 * @param custom_width {string|null}
 * @param custom_height {string|null}
 * @param modal_class {string|null}
 * @return {HTMLElement}
 */
function open_modal(content, custom_width = null, custom_height = null, modal_class= null) {
    modal_content.classList.remove(...modal_content.classList);
    modal.classList.add('show')

    if (custom_width)
        modal_content.style.width = custom_width;
    else
        modal_content.style.width = 'fit-content';
    if (custom_height)
        modal_content.style.height = custom_height;
    else
        modal_content.style.height = 'fit-content';
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

function is_modal_open() {
    return modal.classList.contains('show')
}

window.modal = {open_modal, close_modal, is_opened: is_modal_open}
export {open_modal, close_modal, is_modal_open}