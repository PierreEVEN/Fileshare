import {spawn_item_context_action} from "./item_context_action.js";
import {parse_fetch_result} from "../../../common/widgets/message_box.js";
import {close_item_plain, is_opened, open_this_item} from "./item.js";
import {Filesystem} from "../../../common/tools/filesystem.js";
import {selector} from "../../../common/tools/selector.js";
import {CURRENT_REPOS} from "../../../common/tools/utils";

const directory_hbs = require('./directory.hbs');
const file_hbs = require('./file.hbs');

const filesystem = CURRENT_REPOS ? new Filesystem(CURRENT_REPOS.name) : null;
const viewport_container = document.getElementById('file-list')

function update_repos_content() {
    if (!filesystem)
        return;
    fetch(`/repos/content/?repos=${CURRENT_REPOS.access_key}`)
        .then(async (response) => await parse_fetch_result(response))
        .then((json) => {
            filesystem.clear();

            const directories = {}

            // Retrieve dirs
            json.directories.forEach(dir => {
                directories[dir.id] = dir;
            })

            const path_of = dir => (dir.parent_directory ? `${path_of(directories[dir.parent_directory])}/` : '/') + `${dir.name}/`;
            
            for (const directory of Object.values(directories)) {
                const found = filesystem.directory_from_path(path_of(directory), true);
                found.id = directory.id;
                found.open_upload = directory.open_upload;
                found.description = directory.description;
            }

            json.files.forEach(item => {
                if (!item.description)
                    item.description = '';
                filesystem.add_file(item, item.parent_directory ? path_of(directories[item.parent_directory]) : '/');
            })

            selector.set_current_dir(filesystem.root);
        });
}

function add_directory_to_viewport(dir) {
    const dir_div = directory_hbs({item:dir}, {
        clicked: event => {
            if (!event.target.classList.contains('open-context-button'))
                selector.set_current_dir(dir);
        },
        enter: () => selector.set_hover_item(dir),
        leave: () => {
            if (selector.get_hover_item() === dir)
                selector.set_hover_item(null);
        },
        context_menu: event => {
            spawn_item_context_action(dir);
            event.preventDefault();
        },
    });
    dir.div = dir_div;
    dir_div.object = dir;

    viewport_container.append(dir_div);
    dir.callback_removed = () => dir_div.remove();
}

function add_file_to_viewport(file) {
    const file_div = file_hbs({item:file}, {
        clicked: event => {
            if (event.target.classList.contains('open-context-button'))
                return

            open_this_item(file_div, file);
            selector.set_selected_item(file);
        },
        enter: () => selector.set_hover_item(file),
        leave: () => {
            if (selector.get_hover_item() === file)
                selector.set_hover_item(null);
        },
        context_menu: event => {
            spawn_item_context_action(file);
            event.preventDefault();
        },
    });
    file.div = file_div;
    file_div.object = file;
    viewport_container.append(file_div);
    file.callback_removed = () => file_div.remove();
}

function render_directory(directory) {
    if (!viewport_container)
        return;

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

selector.on_changed_dir((new_dir, _) => {
    selector.set_selected_item(null);
    render_directory(new_dir);
})

update_repos_content();

selector.on_select_item((new_item, old_item) => {
    if (old_item && old_item.div)
        old_item.div.classList.remove("selected");
    if (new_item && new_item.div) {
        new_item.div.classList.add("selected");
        new_item.div.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
    }

    if (is_opened() && new_item)
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
        const elements = is_opened() ? selector.get_current_directory().files : Object.values(selector.get_current_directory().directories).concat(selector.get_current_directory().files);
        select_next_in([...elements])
    }
    if (event.key === 'ArrowLeft') {
        const elements = is_opened() ? selector.get_current_directory().files : Object.values(selector.get_current_directory().directories).concat(selector.get_current_directory().files);
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

export {get_viewport_filesystem, update_repos_content}