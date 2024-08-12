import {LOCAL_USER} from "../../../common/tools/user";
import {ClientString} from "../../../common/tools/client_string";
import {PAGE_CONTEXT} from "../../../common/tools/utils";


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