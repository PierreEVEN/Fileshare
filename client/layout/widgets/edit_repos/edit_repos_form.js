import {open_modal} from "../../../common/widgets/modal.js";

const edit_repos_form = require('./edit_repos.hbs')

function edit_repos(e) {
    open_modal(edit_repos_form(e), null, null, 'edit-repos');
}

window.edit_repos = {edit_repos}
export {edit_repos}