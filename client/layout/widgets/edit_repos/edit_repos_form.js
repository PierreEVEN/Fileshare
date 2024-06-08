import {close_modal, open_modal} from "../../../common/widgets/modal.js";
import {delete_repos} from "../delete_repos/delete_repos_form";
import {ClientString} from "../../../common/tools/client_string";
import {parse_fetch_result} from "../../../common/widgets/message_box";

const edit_repos_form = require('./edit_repos.hbs')

function edit_repos(e) {
    e.prop_public = e.status === 'public';
    e.prop_hidden = e.status === 'hidden';
    e.prop_private = e.status === 'private';
    open_modal(edit_repos_form(e, {
        submit: async () => {

            const data = {
                display_name: ClientString.FromClient(document.getElementById('display_name').value),
                description: ClientString.FromClient(document.getElementById('description').value),
                max_file_size: document.getElementById('max_file_size').value,
                guest_file_lifetime: document.getElementById('guest_file_lifetime').value,
                name: ClientString.FromClient(document.getElementById('name').value),
                status: document.getElementById('status').value,
                allow_visitor_upload: document.getElementById('allow_visitor_upload').value === "on",
            }
            await parse_fetch_result(await fetch(`/${e.username}/${e.name.plain()}/update`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                }));

            close_modal();
        },
        on_delete_repos: () => delete_repos(e)
    }), null, null, 'edit-repos');
}

window.edit_repos = {edit_repos}
export {edit_repos}