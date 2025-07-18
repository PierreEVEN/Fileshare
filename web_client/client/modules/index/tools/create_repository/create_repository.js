import {fetch_api} from "../../../../utilities/request";
import {EncString} from "../../../../types/encstring";
import {MODAL} from "../../modal/modal";
import {Repository} from "../../../../types/repository";
import {Message, NOTIFICATION} from "../message_box/notification";

async function create_repository() {
    const widget = require('./create_repository.hbs')({}, {
        create_repository: async (e) => {
            e.preventDefault();
            const repositories = await fetch_api('repository/create', 'POST',
                [{
                    name: EncString.from_client(widget.hb_elements.repository_name.value),
                    status: widget.hb_elements.repository_type.value
                }]
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de créer le dépôt")));
            for (const repository of repositories) {
                Repository.new(repository);
            }

            MODAL.close();
        }
    });
    MODAL.open(widget, {custom_width: '500px', custom_height: '350px'})
}

export {create_repository}