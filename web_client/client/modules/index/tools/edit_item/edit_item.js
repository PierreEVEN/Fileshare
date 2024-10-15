import {fetch_api} from "../../../../utilities/request";
import {MODAL} from "../../modal/modal";
import {EncString} from "../../../../types/encstring";
import {FilesystemItem} from "../../../../types/filesystem_stream";
import {Message, NOTIFICATION} from "../message_box/notification";

/**
 * @param item {FilesystemItem}
 * @return {Promise<void>}
 */
async function edit_item(item) {
    let data = item.display_data();
    data.is_directory = !data.is_regular_file;
    const widget = require('./edit_item.hbs')(data, {
        submit: async (e) => {
            e.preventDefault();

            const description = document.getElementById('description').value;
            let new_data = {
                id: item.id,
                name: EncString.from_client(document.getElementById('display_name').value),
                description: description.length === 0 ? null : EncString.from_client(description),
                open_upload: item.is_regular_file ? null : document.getElementById('allow_visitor_upload').checked,
            };

            const items = await fetch_api(`item/update/`, 'POST', [new_data])
                .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de modifier l'object")));
            if (items.length !== 0) {
                item.name = new_data.name;
                item.description = new_data.description;
                if (!item.is_regular_file) {
                    item.open_upload = new_data.open_upload;
                }
                await item.refresh();
            }

            MODAL.close();
        }
    });
    MODAL.open(widget, {custom_width: '600px', custom_height: '480px'})
}

export {edit_item}