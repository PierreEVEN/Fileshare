
import {delete_repository} from "../delete_repository/delete_repository";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";
import {get_app} from "../../../../app";

require('./edit-repository.scss')

/**
 * @param repository {Repository}
 * @param context {HTMLElement}
 */
function edit_repository(repository, context) {
    let data = repository.display_data();
    data.prop_public = repository.status.toString() === 'Public';
    data.prop_hidden = repository.status.toString() === 'Hidden';
    data.prop_private = repository.status.toString() === 'Private';
    const widget = require('./edit_repository.hbs')(data, {
        submit: async (e) => {
            e.preventDefault();

            const description = widget.hb_elements.description.value;
            let new_data = {
                id: repository.id,
                display_name: EncString.from_client(widget.hb_elements.display_name.value),
                url_name: EncString.from_client(widget.hb_elements.url_name.value),
                max_file_size: Number(widget.hb_elements.max_file_size.value),
                visitor_file_lifetime: Number(widget.hb_elements.visitor_file_lifetime.value),
                allow_visitor_upload: widget.hb_elements.allow_visitor_upload.checked,
                status: widget.hb_elements.status.value,
                description: EncString.from_client(description.length === 0 ? null : description)
            };

            const repositories = await get_app(widget).fetch_api(`repository/update`, 'POST', [new_data])
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

            get_app(widget).get_modal().close();
        },
        delete: async () => {
            await delete_repository(repository);
        }
    });
    get_app(context).get_modal().open(widget, {custom_width: '800px', custom_height: '85%'})
}

export {edit_repository}