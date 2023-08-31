import {gen_context_action, is_item_opened, show_folder_content} from "./viewport.js";
import {parse_fetch_result} from "../../utils.js";
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

    viewport_container.append(object_button);
    dir.callback_removed = () => object_button.remove();
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

    /* CONTEXT ACTION BUTTON */
    object_button.append(gen_context_action(file));

    const div = document.createElement('div');
    div.classList.add('item-preview')
    div.append(gen_item(file.name, '/fileshare/repos/' + current_repos.access_key + '/file/' + file.id, file.size, file.mimetype, true));
    object_button.append(div);

    viewport_container.append(object_button);
    file.callback_removed = () => object_button.remove();
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
    render_directory(new_dir);
})

fetch_repos_content();


function select_next_in(elements) {
    let next = false;
    for (const item of elements) {
        if (next) {
            select_element(item);
            return;
        }
        if (item === selected_element)
            next = true;
    }
    if (elements.length > 0)
        select_element(elements[0]);
}

document.addEventListener('keydown', (event) => {
    if ((event.key === 'Backspace' || event.key === 'Escape') && (current_directory.parent || is_opened())) {
        if (is_opened())
            close_item_plain()
        else {
            const last_dir = current_directory;
            select_directory(current_directory.parent)
            if (current_directory !== last_dir)
                select_element(last_dir);
        }
    }
    if (event.key === 'ArrowRight') {
        const elements = is_item_opened() ? current_directory.files : Object.values(current_directory.folders).concat(current_directory.files);
        select_next_in([...elements])
    }
    if (event.key === 'ArrowLeft') {
        const elements = is_item_opened() ? current_directory.files : Object.values(current_directory.folders).concat(current_directory.files);
        select_next_in([...elements].reverse())
    }
    if (event.key === 'Enter' && selected_element) {
        if (selected_element.files)
            select_directory(selected_element);
        else
            open_this_item(selected_element.div, selected_element);
    }
}, false);

function select_element(element) {
    return;
    if (element === selected_element)
        return;

    if (selected_element && selected_element.div) {
        selected_element.div.classList.remove("selected");
    }
    if (selected_element.div) {
        selected_element.div.classList.add("selected");
        selected_element.div.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
    }

    if (is_item_opened() && selected_element)
        open_this_item(null, element);
}

window.addEventListener('popstate', function (event) {
    if (!event.state)
        return;
    let path = event.state.split('/').reverse();

    const dir = filesystem.directory_from_path(path, false)
    if (dir)
        selector.set_current_dir(dir);
}, false);