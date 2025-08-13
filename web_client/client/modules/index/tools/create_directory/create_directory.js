import {EncString} from "../../../../types/encstring";
import {overwrite_or_restore} from "../item_conflict/item_conflict";
import {Message, NOTIFICATION} from "../message_box/notification";


/**
 * @param app {FileshareApp}
 * @param repository {number}
 * @param parent_item {number|null}
 */
function create_directory(app, repository, parent_item = null) {
    const widget = require('./create_directory.hbs')({}, {
        mkdir: async (e) => {
            e.preventDefault();
            const new_name = widget.hb_elements.name.value;
            const child = parent_item ? await (await app.pool.fetch_repository(repository)).find_child(new_name) : await (await app.pool.fetch_repository(repository)).find_child(new_name);
            if (child) {
                if (!(await overwrite_or_restore(app, new_name, child)).handled) {
                    return;
                }
            }

            const directories = await app.fetch_api('item/new-directory', 'POST',
                [{
                    name: EncString.from_client(new_name),
                    repository: repository,
                    parent_item: parent_item
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dossier")));

            for (const item of directories) {
                await app.pool._register_item(item);
            }

            app.get_modal().close();
        }
    });
    app.get_modal().open(widget, {custom_width: '500px', custom_height: '250px'})
}

export {create_directory}