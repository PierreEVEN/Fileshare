import {open_modal} from "../../../common/widgets/modal.js";
import {LOCAL_USER} from "../../../common/tools/user";
import {parse_fetch_result} from "../../../common/widgets/message_box";

const create_repos = require('./create_repos.hbs')

function open_create_repos_modal() {
    open_modal(create_repos(), '500px', '350px', 'create-repos');
}

window.create_repos = {open_create_repos_modal}
export {open_create_repos_modal}
