import {gen_context_action, is_item_opened, spawn_item_context_action} from "./viewport.js";
import {parse_fetch_result} from "../../message_box.js";
import {close_item_plain, gen_item, is_opened, open_this_item} from "./item.js";
import {Filesystem} from "../../filesystem.js";
import {selector} from "../../selector.js";

const filesystem = current_repos ? new Filesystem(current_repos.name) : null;
const viewport_container = document.getElementById('file-list')

function fetch_repos_content() {
    if (!filesystem)
        return;

    fetch('/fileshare/repos/' + current_repos.access_key + '/content/')
        .then(async (response) => await parse_fetch_result(response))
        .then((json) => {
            filesystem.clear();
            json.content.forEach((item) => filesystem.add_file(item, item.virtual_folder))
            selector.set_current_dir(filesystem.root);
        });
}

function add_directory_to_viewport(dir) {
    const object_button = document.createElement('div');
    object_button.classList.add('object-button')
    object_button.onclick = (event) => {
        if (!event.target.classList.contains('open-context-button'))
            selector.set_current_dir(dir);
    }
    object_button.addEventListener('contextmenu', event => {
        spawn_item_context_action(dir);
        event.preventDefault();
    })


    /* CONTEXT ACTION BUTTON */
    object_button.append(gen_context_action(dir));

    const div = document.createElement('div');
    div.classList.add('item-preview')
    div.classList.add('folder')

    /* ICON */
    const img = document.createElement('img')
    img.src = "/images/icons/icons8-folder-96.png";
    img.alt = "dossier";
    div.append(img);

    /* DIR NAME */
    const p = document.createElement('p');
    p.innerText = dir.name;
    div.append(p);
    object_button.append(div)
    object_button.onmouseenter = () => {
        selector.set_hover_item(dir);
    }
    object_button.onmouseleave = () => {
        if (selector.get_hover_item() === dir)
            selector.set_hover_item(null);
    }

    viewport_container.append(object_button);
    dir.callback_removed = () => object_button.remove();
    dir.div = object_button;
    object_button.object = dir;
}

function add_file_to_viewport(file) {
    const object_button = document.createElement('div');
    object_button.classList.add('object-button')
    object_button.onclick = (event) => {
        if (event.target.classList.contains('open-context-button'))
            return
        open_this_item(object_button, file);
        selector.set_selected_item(file);
    }
    object_button.addEventListener('contextmenu', event => {
        spawn_item_context_action(file);
        event.preventDefault();
    })

    /* CONTEXT ACTION BUTTON */
    object_button.append(gen_context_action(file));

    const div = document.createElement('div');
    div.classList.add('item-preview')
    div.append(gen_item(file.name, '/fileshare/repos/' + current_repos.access_key + '/file/' + file.id, file.size, file.mimetype, true));
    object_button.append(div);
    object_button.onmouseenter = () => {
        selector.set_hover_item(file);
    }
    object_button.onmouseleave = () => {
        if (selector.get_hover_item() === file)
            selector.set_hover_item(null);
    }

    viewport_container.append(object_button);
    file.callback_removed = () => object_button.remove();
    file.div = object_button;
    object_button.object = file;
}

function render_directory(directory) {
    viewport_container.innerHTML = null;
    for (const dir of Object.values(directory.directories))
        add_directory_to_viewport(dir);
    for (const file of directory.files) {
        add_file_to_viewport(file);
    }
    directory.callback_directory_added = add_directory_to_viewport;
    directory.callback_file_added = add_file_to_viewport;
    directory.callback_removed = () => selector.set_current_dir(filesystem.root);
}

selector.on_changed_dir((new_dir, old_dir) => {
    selector.set_selected_item(null);
    render_directory(new_dir);
})

fetch_repos_content();

selector.on_select_item((new_item, old_item) => {
    if (old_item && old_item.div)
        old_item.div.classList.remove("selected");
    if (new_item && new_item.div) {
        new_item.div.classList.add("selected");
        new_item.div.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
    }

    if (is_item_opened() && new_item)
        open_this_item(null, new_item);
})

function select_next_in(elements) {
    if (!selector.get_selected_item())
        selector.set_selected_item(selector.get_hover_item())

    let next = false;
    for (const item of elements) {
        if (next) {
            selector.set_selected_item(item);
            return;
        }
        if (item === selector.get_selected_item())
            next = true;
    }
    if (elements.length > 0)
        selector.set_selected_item(elements[0]);
}

document.addEventListener('keydown', (event) => {
    if ((event.key === 'Backspace' || event.key === 'Escape') && (selector.get_current_directory().parent || is_opened())) {
        if (is_opened())
            close_item_plain()
        else {
            const last_dir = selector.get_current_directory();
            selector.set_current_dir(selector.get_current_directory().parent)
            selector.set_selected_item(last_dir);
        }
    }
    if (event.key === 'ArrowRight') {
        const elements = is_item_opened() ? selector.get_current_directory().files : Object.values(selector.get_current_directory().directories).concat(selector.get_current_directory().files);
        select_next_in([...elements])
    }
    if (event.key === 'ArrowLeft') {
        const elements = is_item_opened() ? selector.get_current_directory().files : Object.values(selector.get_current_directory().directories).concat(selector.get_current_directory().files);
        select_next_in([...elements].reverse())
    }
    if (event.key === 'Enter' && selector.get_current_directory()) {
        if (!selector.get_selected_item())
            selector.set_selected_item(selector.get_hover_item())

        if (selector.get_selected_item()) {
            if (selector.get_selected_item().is_directory)
                selector.set_current_dir(selector.get_selected_item());
            else
                open_this_item(selector.get_selected_item().div, selector.get_selected_item());
        }
    }
}, false);

window.addEventListener('popstate', function (event) {
    if (!event.state)
        return;

    const dir = filesystem.directory_from_path(event.state, false)
    if (dir)
        selector.set_current_dir(dir);
}, false);

function get_viewport_filesystem() {
    return filesystem;
}

export {get_viewport_filesystem}