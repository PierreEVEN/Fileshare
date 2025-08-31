import {UploadFile} from "../upload_tree/upload_file";
import {UploadDirectory} from "../upload_tree/upload_directory";

/**
 * @param upload_manager {UploadManager}
 * @param directory {boolean}
 * @return {Promise<UploadItem[]>}
 */
async function select_files_or_directories(upload_manager, directory) {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    if (directory) {
        inputElement.webkitdirectory = true;
        inputElement.directory = true;
        inputElement.multiple = true;
    } else {
        inputElement.multiple = true;
    }
    return await new Promise((resolve) => {
        inputElement.addEventListener("cancel", () => {
            resolve([]);
        });
        inputElement.addEventListener("change", async (e) => {
            const roots = new Map();
            const files = [];

            /**
             * @param remaining_path {string[]}
             * @param parent {UploadDirectory|null}
             * @return {Promise<UploadDirectory|null>}
             */
            async function find_or_create_directory(remaining_path, parent) {
                if (remaining_path.length === 0)
                    return null;
                let dir_name = remaining_path.pop();
                let available = parent ? parent.children() : roots;
                if (!available.has(dir_name)) {
                    let directory = new UploadDirectory(upload_manager, dir_name, null);
                    if (!parent)
                        files.push(directory);
                    else
                        parent.add_child(directory);
                    available.set(dir_name, directory);
                }
                if (remaining_path.length === 0)
                    return available.get(dir_name);
                else
                    return await find_or_create_directory(remaining_path, available.get(dir_name));
            }

            for (const file of e.target['files']) {
                const directory_path = (file.webkitRelativePath ? file.webkitRelativePath : '').split('/').filter(Boolean);
                directory_path.pop();
                let directory = await find_or_create_directory(directory_path.reverse(), null);
                let item = new UploadFile(upload_manager, file, file.name);
                if (directory) {
                    directory.add_child(item);
                } else
                    files.push(item);
            }
            resolve(files);
        })
        inputElement.dispatchEvent(new MouseEvent("click"));
    })
}

export {select_files_or_directories}