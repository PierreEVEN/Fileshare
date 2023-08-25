import {update_path} from "./repos_builder/path.js";
import {show_folder_content} from "./repos_builder/viewport.js";

const repos_data = {}
let current_directory = null;

function fetch_repos_content() {
    if (!current_repos)
        return;

    fetch('/fileshare/repos/' + current_repos.access_key + '/content/')
        .then((response) => response.json())
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && current_directory.parent)
        select_directory(current_directory.parent)
}, false);

function select_directory(directory) {
    current_directory = directory;
    show_folder_content(directory, select_directory)
    update_path(directory, select_directory);
}