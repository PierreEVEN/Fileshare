import {open_modal} from "../widgets/modal.js";
import {logout, open_modal_signin, open_modal_signup} from "./auth/auth";

const create_repos = require('./create_repos.hbs')

function open_create_repos_modal() {
    open_modal(create_repos(), '500px', '350px');
}

window.create_repos = {open_create_repos_modal}
export {open_create_repos_modal}
