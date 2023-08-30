import {update_path} from "./repos_builder/path.js";
import {is_item_opened, show_folder_content} from "./repos_builder/viewport.js";
import {parse_fetch_result} from "./utils.js";
import {close_item_plain, is_opened, open_this_item} from "./repos_builder/item.js";

const repos_data = {}
let current_directory = null;
let selected_element = null;

function fetch_repos_content() {
    if (!current_repos)
        return;

    fetch('/fileshare/repos/' + current_repos.access_key + '/content/')
        .then(async (response) => {
            return await parse_fetch_result(response);
        })
        .then((json) => {

            const virtual_content = {files: [], folders: {}, parent: null, name: json.name}

            const path_formatted = (path) => {
                if (path.length === 0 || path === '/')
                    return []
                if (path[0] === '/')
                    path = path.slice(1);
                return path.split('/').reverse()
            }

            const insert_file = (path, file, target) => {

                if (path.length === 0)
                    target.files.push(file)
                else {
                    const current_path = path.pop();
                    if (!target.folders[current_path])
                        target.folders[current_path] = {files: [], folders: {}, parent: target, name: current_path}
                    insert_file(path, file, target.folders[current_path])
                }
            }

            json.content.forEach((e) => {
                insert_file(path_formatted(e.virtual_folder), e, virtual_content)
            })

            repos_data.root = virtual_content;
            repos_data.access_key = json.access_key;
            select_directory(repos_data.root)
        });
}

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
    if (event.key === 'Backspace' && current_directory.parent) {
        if (is_opened())
            close_item_plain()
        else
            select_directory(current_directory.parent)
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

function select_directory(directory) {
    current_directory = directory;
    show_folder_content(directory, select_directory)
    update_path(directory, select_directory);
    selected_element = null;
}

function select_element(element) {
    if (element === selected_element)
        return;

    if (selected_element && selected_element.div) {
        selected_element.div.classList.remove("selected");
    }
    selected_element = element;
    if (selected_element.div) {
        selected_element.div.classList.add("selected");
        selected_element.div.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
    }

    if (is_item_opened() && selected_element)
        open_this_item(null, element);
}