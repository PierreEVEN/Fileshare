import {open_modal} from "../../../common/widgets/modal.js";
import {delete_repos} from "../delete_repos/delete_repos_form";

const edit_repos_form = require('./edit_repos.hbs')

function edit_repos(e) {
    e.prop_public = e.status === 'public';
    e.prop_hidden = e.status === 'hidden';
    e.prop_private = e.status === 'private';
    open_modal(edit_repos_form(e, {on_delete_repos: () => delete_repos(e)}), null, null, 'edit-repos');
}

window.edit_repos = {edit_repos}
export {edit_repos}