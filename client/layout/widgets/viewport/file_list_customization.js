import {LOCAL_USER} from "../../../common/tools/user";
import {ClientString} from "../../../common/tools/client_string";
import {PAGE_CONTEXT, permissions} from "../../../common/tools/utils";

async function update_last_repos() {
    const repos_list = document.getElementById('last-repos-list')
    if (!repos_list)
        return;
    repos_list.innerHTML = '';
    const elements = await LOCAL_USER.get_last_repos();
    for (const repos of elements.reverse()) {
        const button = document.createElement('button');
        button.onclick = () => {
            window.location.href = `${window.origin}/${new ClientString(repos.username).encoded()}/${new ClientString(repos.name).encoded()}`;
        }
        if (PAGE_CONTEXT && PAGE_CONTEXT.display_repos && PAGE_CONTEXT.display_repos.id === repos.id)
            button.classList.add('selected-repos');
        button.innerText = new ClientString(repos.name).plain();
        repos_list.append(button)
    }
}

update_last_repos();

/*
async function open_repos_context_menu()
if (await permissions.can_user_edit_repos(PAGE_CONTEXT.repos_path())) {
    const edit_button = document.createElement('button');
    edit_button.onclick = () => edit_repos.edit_repos(PAGE_CONTEXT.display_repos);
    edit_button.innerHTML = `<img src='/images/icons/icons8-edit-96.png' alt='modifier'>`;
    edit_button.classList.add('plus-button')
    tool_buttons.append(edit_button);
}

export {}
*/