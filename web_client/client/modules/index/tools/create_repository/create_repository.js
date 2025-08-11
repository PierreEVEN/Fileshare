import {EncString} from "../../../../types/encstring";
import {Repository} from "../../../../types/repository";
import {Message, NOTIFICATION} from "../message_box/notification";
import {StateSelection} from "../../../../utilities/state_selection";

/**
 * @param app {FileshareApp}
 * @returns {Promise<void>}
 */
async function create_repository(app) {
    const widget = require('./create_repository.hbs')({}, {
        create_repository: async (e) => {
            e.preventDefault();
            const repositories = await app.fetch_api('repository/create', 'POST',
                [{
                    name: EncString.from_client(widget.hb_elements.repository_name.value),
                    status: widget.hb_elements.repository_type.value
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dépôt")));
            for (const repository of repositories) {
                await app.state.select(new StateSelection().set_repository(await app.pool._register_repository(repository)))
            }

            app.get_modal().close();
        }
    });
    app.get_modal().open(widget, {custom_width: '500px', custom_height: '350px'})
}

export {create_repository}