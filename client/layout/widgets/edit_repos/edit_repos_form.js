import {open_modal} from "../../../common/widgets/modal.js";

const edit_repos_form = require('./edit_repos.hbs')

function edit_repos(e) {
    fetch(`/repos/infos/?repos=${e}`).then(res => res.json())
        .then(json => {
            console.log(json)
            open_modal(edit_repos_form(json), null, null, 'edit-repos');
        });
}

window.edit_repos = {edit_repos}
export {edit_repos}