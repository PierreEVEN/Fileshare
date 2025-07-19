import {EncString} from "../../../../types/encstring";
import {Repository} from "../../../../types/repository";
import {Message, NOTIFICATION} from "../message_box/notification";
import {get_app} from "../../../../app";

async function create_repository(context) {
    const widget = require('./create_repository.hbs')({}, {
        create_repository: async (e) => {
            e.preventDefault();
            const repositories = await get_app(widget).fetch_api('repository/create', 'POST',
                [{
                    name: EncString.from_client(widget.hb_elements.repository_name.value),
                    status: widget.hb_elements.repository_type.value
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dépôt")));
            for (const repository of repositories) {
                Repository.new(get_app(widget), repository);
            }

            get_app(widget).get_modal().close();
        }
    });
    get_app(context).get_modal().open(widget, {custom_width: '500px', custom_height: '350px'})
}

export {create_repository}