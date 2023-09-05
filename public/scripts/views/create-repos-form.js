import {open_modal} from "../widgets/modal.js";
import {logout, open_modal_signin, open_modal_signup} from "./auth";

async function open_create_repos_modal() {
    open_modal(await mustache.render('repos/create_repos'), '500px', '350px');
}

window.create_repos = {open_create_repos_modal}
export {open_create_repos_modal}
