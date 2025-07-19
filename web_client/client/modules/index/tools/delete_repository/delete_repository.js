import {Repository} from "../../../../types/repository";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";
import {get_app} from "../../../../app";

/**
 * @param repository
 * @return {Promise<void>}
 */
async function delete_repository(repository) {
    const widget = require('./delete_repository.hbs')({name: repository.display_name.plain()}, {
        delete_repository: async (e) => {
            e.preventDefault();

            if (widget.hb_elements.repository.value !== repository.display_name.plain())
                return;

            const repositories = await get_app(widget).fetch_api(`repository/delete`, 'POST',
                {
                    credentials: {
                        login: EncString.from_client(widget.hb_elements.login.value),
                        password: EncString.from_client(widget.hb_elements.password.value),
                    },
                    repositories: [repository.id]
                }
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le dépôt")));
            for (const repository_id of repositories) {
                (await Repository.find(this, repository_id)).remove();
            }

            get_app(widget).get_modal().close();
        }
    });
    get_app(widget).get_modal().open(widget, {custom_width: '500px', custom_height: '450px'})
}

export {delete_repository}