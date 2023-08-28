import {open_modal} from "./modal.js";

function open_create_repos_modal() {
    const create_repos_content = document.createElement('div')
    create_repos_content.classList.add('modal-content')
    create_repos_content.innerHTML = `
            <h1>Nouveau dépôt</h1>
            <form action="/fileshare/create-repos" method="post">
                <div class="field">
                    <label for='name'>
                    <input type="text" name="name" placeholder="Nom" id="name" required>
                </div>
                <div class="field">
                    <label for='type'>
                    <select name="type" onChange="" id="type">
                        <option>Invisible</option>
                        <option>Publique</option>
                        <option>Privé</option>
                    </select>
                </div>

                <input type="submit" value="Nouveau dépot">
            </form>`
    open_modal(create_repos_content, '500px', '350px');
}

module.create_repos = {open_create_repos_modal}
export {open_create_repos_modal}
