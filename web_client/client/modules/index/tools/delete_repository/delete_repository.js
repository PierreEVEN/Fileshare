import {fetch_api} from "../../../../utilities/request";
import {Repository} from "../../../../types/repository";
import {MODAL} from "../../modal/modal";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";

/**
 * @param repository
 * @return {Promise<void>}
 */
async function delete_repository(repository) {
    const widget = require('./delete_repository.hbs')({name: repository.display_name.plain()}, {
        delete_repository: async (e) => {
            e.preventDefault();

            if (widget.elements.repository.value !== repository.display_name.plain())
                return;

            const repositories = await fetch_api(`repository/delete/`, 'POST',
                {
                    credentials: {
                        login: EncString.from_client(widget.elements.login.value),
                        password: EncString.from_client(widget.elements.password.value),
                    },
                    repositories: [repository.id]
                }
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le dépôt")));
            for (const repository_id of repositories) {
                (await Repository.find(repository_id)).remove();
            }

            MODAL.close();
        }
    });
    MODAL.open(widget, {custom_width: '500px', custom_height: '450px'})
}

export {delete_repository}