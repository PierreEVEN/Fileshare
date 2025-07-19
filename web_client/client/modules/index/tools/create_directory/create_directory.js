import {EncString} from "../../../../types/encstring";
import {FilesystemItem, FilesystemStream} from "../../../../types/filesystem_stream";
import {overwrite_or_restore} from "../item_conflict/item_conflict";
import {Message, NOTIFICATION} from "../message_box/notification";
import {get_app} from "../../../../app";


/**
 * @param repository {number}
 * @param parent_item {number|null}
 * @param context {HTMLElement}
 */
function create_directory(repository, parent_item = null, context) {
    const widget = require('./create_directory.hbs')({}, {
        mkdir: async (e) => {
            e.preventDefault();
            const new_name = widget.hb_elements.name.value;
            const fs = FilesystemStream.find(repository);
            const child = await fs.find_child(new_name, parent_item ? await fs.fetch_item(parent_item) : null);
            if (child) {
                if (!(await overwrite_or_restore(new_name, child, context)).handled) {
                    return;
                }
            }

            const directories = await get_app(context).fetch_api('item/new-directory', 'POST',
                [{
                    name: EncString.from_client(new_name),
                    repository: repository,
                    parent_item: parent_item
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dossier")));

            for (const item of directories) {
                await FilesystemItem.new(item);
            }

            get_app(widget).get_modal().close();
        }
    });
    get_app(context).get_modal().open(widget, {custom_width: '500px', custom_height: '250px'})
}

export {create_directory}