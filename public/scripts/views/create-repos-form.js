import {open_modal} from "../widgets/modal.js";

async function open_create_repos_modal() {
    open_modal(await module.mustache.render('repos/create_repos'), '500px', '350px');
}

module.create_repos = {open_create_repos_modal}
export {open_create_repos_modal}
