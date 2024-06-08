import {spawn_item_context_action} from "./item_context_action.js";
import {parse_fetch_result} from "../../../common/widgets/message_box.js";
import {close_item_plain, is_item_preview_open, open_item_preview} from "./item.js";
import {Filesystem, FilesystemObject} from "../../../common/tools/filesystem_v2.js";
import {selector} from "../../../common/tools/selector.js";
import {PAGE_CONTEXT} from "../../../common/tools/utils";
import {LOCAL_USER} from "../../../common/tools/user";
import {PathBuilder} from "./path_builder";
import {close_modal, is_modal_open} from "../../../common/widgets/modal";

const directory_hbs = require('./directory.hbs');
const file_hbs = require('./file.hbs');

const filesystem = PAGE_CONTEXT.display_repos ? new Filesystem(PAGE_CONTEXT.display_repos.display_name) : null;
const _ = new PathBuilder(filesystem);
selector.filesystem = filesystem;
const viewport_container = document.getElementById('file-list')

/**
 * @type {ObjectListener|null}
 */
let current_directory_listener = null;

/**
 * @type {Map<string, HTMLElement>}
 */
const entry_widgets = new Map();

/**
 * @type {string[]}
 */
let page_content = [];

function update_repos_content() {
    if (!filesystem)
        return;
    fetch(`${PAGE_CONTEXT.repos_path()}/content/`, {
        headers: {
            'content-authtoken': LOCAL_USER.get_token(),
            'accept': 'application/json',
        },
    })
        .then(async (response) => await parse_fetch_result(response))
        .then((json) => {
            filesystem.clear();

            for (const item of json)
                filesystem.add_object(FilesystemObject.FromServerData(item));

            selector.set_current_dir(filesystem.get_object_from_path(PAGE_CONTEXT.request_path.plain()));
        });
}

/**
 * @param dir {FilesystemObject}
 */
function add_directory_to_viewport(dir) {
    const dir_div = directory_hbs({item: dir}, {
        dblclicked: event => {
            if (!event.target.classList.contains('open-context-button'))
                selector.set_current_dir(dir.id);
        },
        clicked: event => {
            if (window.matchMedia("(pointer: coarse)").matches)
                selector.set_current_dir(dir.id);
            else
                selector.select_item(dir.id, event.shiftKey, event.ctrlKey);
        },
        enter: () => selector.set_hover_item(dir.id),
        leave: () => {
            if (selector.get_hover_item() === dir.id)
                selector.set_hover_item(null);
        },
        context_menu: event => {
            spawn_item_context_action(dir);
            event.preventDefault();
        },
    });
    entry_widgets.set(dir.id, dir_div)
    dir_div.object = dir;
    viewport_container.append(dir_div);
}

/**
 * @param file {FilesystemObject}
 */
function add_file_to_viewport(file) {
    const file_div = file_hbs({item: file}, {
        dblclicked: event => {
            if (event.target.classList.contains('open-context-button'))
                return;

            open_item_preview(file_div, file);
            selector.select_item(file.id, event.shiftKey, event.ctrlKey, true);
        },
        clicked: event => {
            if (window.matchMedia("(pointer: coarse)").matches) {
                open_item_preview(file_div, file);
                selector.select_item(file.id, event.shiftKey, event.ctrlKey, true);
            } else {
                selector.select_item(file.id, event.shiftKey, event.ctrlKey);
            }
        },
        enter: () => selector.set_hover_item(file.id),
        leave: () => {
            if (selector.get_hover_item() === file.id)
                selector.set_hover_item(null);
        },
        context_menu: event => {
            spawn_item_context_action(file);
            event.preventDefault();
        },
    });
    entry_widgets.set(file.id, file_div)
    file_div.object = file;
    viewport_container.append(file_div);
}

/**
 * @param directory {string|null}
 */
function render_directory(directory) {
    if (!viewport_container)
        return;

    viewport_container.innerHTML = null;

    page_content = filesystem.get_objects_in_directory(directory);
    for (const object_id of page_content) {
        const object = filesystem.get_object_data(object_id);
        if (!object.is_regular_file)
            add_directory_to_viewport(object);
    }

    for (const object_id of page_content) {
        const object = filesystem.get_object_data(object_id);
        if (object.is_regular_file)
            add_file_to_viewport(object);
    }

    if (current_directory_listener)
        current_directory_listener.destroy();

    current_directory_listener = filesystem.create_listener(directory);
    current_directory_listener.on_add_object = (object_id) => {
        const object = filesystem.get_object_data(object_id);
        if (object.is_regular_file)
            add_file_to_viewport(object);
        else
            add_directory_to_viewport(object);
    };

    current_directory_listener.on_remove_object = (object_id) => {
        let widget = entry_widgets.get(object_id);
        if (widget)
            widget.remove();
    };

    current_directory_listener.on_update_object = (object_id) => {
        const widget = entry_widgets.get(object_id);
        if (widget)
            widget.remove();
        const new_data = filesystem.get_object_data(object_id);
        if (new_data) {
            if (new_data.is_regular_file)
                add_file_to_viewport(new_data);
            else
                add_directory_to_viewport(new_data);
        }
    };
}

selector.on_changed_dir((new_dir, _) => {
    entry_widgets.clear();
    render_directory(new_dir);

    const dir_data = filesystem.get_object_data(new_dir)
    const description = new_dir && dir_data && dir_data.parent_item !== null ? dir_data.description.plain() : PAGE_CONTEXT.display_repos.description.plain();
    if (description && description !== '' && description !== 'null') {
        import('../../../embed_viewers/custom_elements/document/showdown_loader').then(showdown => {
            const directory_description = document.getElementById('directory-description')
            if (directory_description) {
                directory_description.innerHTML = showdown.convert_text(description)
                directory_description.style.padding = '20px';
            }
        })
    } else {
        const directory_description = document.getElementById('directory-description')
        if (directory_description) {
            directory_description.innerText = '';
            directory_description.style.padding = '0';
        }
    }
})

selector.bind_on_select_item((item, should_select) => {
    const widget = entry_widgets.get(item)
    if (widget) {
        if (should_select) {
            widget.classList.add("selected");
            widget.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
        } else {
            widget.classList.remove("selected");
        }
    }

    if (is_item_preview_open() && item)
        open_item_preview(entry_widgets.get(selector.last_selected_item), filesystem.get_object_data(selector.last_selected_item))
})

/**
 * @param object {string}
 * @return {string|null}
 */
function get_object_after(object) {
    if (!object && page_content.length !== 0)
        return page_content[0];
    for (let i = 0; i < page_content.length; ++i)
        if (page_content[i] === object)
            return page_content[(i + 1) % page_content.length];
    return null;
}

function get_object_before(object) {
    if (!object && page_content.length !== 0)
        return page_content[page_content.length - 1];
    for (let i = 0; i < page_content.length; ++i)
        if (page_content[i] === object)
            return page_content[(i - 1 + page_content.length) % page_content.length];
    return null;
}

function select_previous_element() {
    selector.select_item(get_object_before(selector.last_selected_item), event.shiftKey, event.ctrlKey);
}

function select_next_element() {
    selector.select_item(get_object_after(selector.last_selected_item), event.shiftKey, event.ctrlKey);
}

document.addEventListener('keydown', (event) => {
    if ((event.key === 'Backspace' || event.key === 'Escape')) {
        if (is_modal_open()) {
            if (event.key === 'Escape')
                close_modal();
            return;
        }
        if (is_item_preview_open())
            close_item_plain()
        else {
            const current_data = filesystem.get_object_data(selector.get_current_directory());
            if (current_data) {
                selector.set_current_dir(current_data.parent_item)
                selector.select_item(current_data.id, false, false);
            }
        }
    }
    if (event.key === 'ArrowRight') {
        if (is_modal_open())
            return;
        select_next_element();
    }
    if (event.key === 'ArrowLeft') {
        if (is_modal_open())
            return;
        select_previous_element();
    }
    if (event.key === 'Enter') {
        if (is_modal_open())
            return;
        if (!selector.last_selected_item || selector.get_hover_item())
            selector.select_item(selector.get_hover_item(), event.shiftKey, event.ctrlKey, true);

        const current_data = filesystem.get_object_data(selector.last_selected_item);

        if (current_data) {
            if (current_data.is_regular_file)
                open_item_preview(entry_widgets.get(current_data.id), current_data);
            else
                selector.set_current_dir(current_data.id);
        }
    }
}, false);

window.addEventListener('popstate', function (event) {
    if (!event.state)
        return;

    const dir = filesystem.get_object_from_path(event.state)
    selector.set_current_dir(dir);
}, false);

function get_viewport_filesystem() {
    return filesystem;
}

update_repos_content();
export {get_viewport_filesystem, update_repos_content, select_previous_element, select_next_element}