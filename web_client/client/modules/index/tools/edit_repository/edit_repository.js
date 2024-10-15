
import {MODAL} from "../../modal/modal";
import {fetch_api} from "../../../../utilities/request";
import {delete_repository} from "../delete_repository/delete_repository";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";

require('./edit-repository.scss')

/**
 * @param repository {Repository}
 */
function edit_repository(repository) {
    let data = repository.display_data();
    data.prop_public = repository.status.toString() === 'Public';
    data.prop_hidden = repository.status.toString() === 'Hidden';
    data.prop_private = repository.status.toString() === 'Private';
    const widget = require('./edit_repository.hbs')(data, {
        submit: async (e) => {
            e.preventDefault();

            const description = document.getElementById('description').value;
            let new_data = {
                id: repository.id,
                display_name: EncString.from_client(document.getElementById('display_name').value),
                url_name: EncString.from_client(document.getElementById('url_name').value),
                max_file_size: Number(document.getElementById('max_file_size').value),
                visitor_file_lifetime: Number(document.getElementById('visitor_file_lifetime').value),
                allow_visitor_upload: document.getElementById('allow_visitor_upload').checked,
                status: document.getElementById('status').value,
                description: EncString.from_client(description.length === 0 ? null : description)
            };

            const repositories = await fetch_api(`repository/update/`, 'POST', [new_data])
                .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de modifier le dépôt")));
            if (repositories.length !== 0) {
                repository.display_name = new_data.display_name;
                repository.description = new_data.description;
                repository.url_name = new_data.url_name;
                repository.max_file_size = new_data.max_file_size;
                repository.visitor_file_lifetime = new_data.visitor_file_lifetime;
                repository.allow_visitor_upload = new_data.allow_visitor_upload;
                repository.status = new_data.status;
                repository.refresh();
            }

            MODAL.close();
        },
        delete: async () => {
            await delete_repository(repository);
        }
    });
    MODAL.open(widget, {custom_width: '800px', custom_height: '85%'})
}

export {edit_repository}