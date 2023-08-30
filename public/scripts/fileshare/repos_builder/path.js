const current_path = document.getElementById('current-path');

function update_path(current_folder, on_path_select_folder) {
    if (!current_path)
        return;

    current_path.innerHTML = ''
    let recurse_folder = current_folder;
    const buttons = []
    let full_path = null;
    do {
        // Add button for each directory of the current path
        const button = document.createElement('button')
        button.innerText = recurse_folder.name;
        const clicked_folder = recurse_folder;
        button.onclick = () => on_path_select_folder(clicked_folder);
        buttons.push(button)

        full_path = full_path ? '/' + recurse_folder.name + full_path : '/';

        if (recurse_folder.parent) {
            // Add separator between directories
            const separator = document.createElement('p')
            separator.innerText = '>'
            buttons.push(separator)
        }
        recurse_folder = recurse_folder.parent;
    }
    while (recurse_folder)

    for (const button of buttons.reverse()) {
        current_path.append(button);
    }

    if (current_folder.parent) {
        const back_button = document.createElement('button');
        back_button.innerHTML = `<img src="/images/icons/icons8-back-64.png" alt="Back">`
        back_button.onclick = () => on_path_select_folder(current_folder.parent);
        current_path.append(back_button);
    }

    console.log(window.location.href)
    window.history.pushState(full_path, null, `${window.location.href.split('?')[0]}?directory=${full_path}`);
}

window.addEventListener('popstate', function(event) {
    console.log('Change dir to :', event.state)

}, false);

export {update_path}