import {EncString} from "../../../src/encstring";
import {Message, NOTIFICATION} from "../../misc/message_box/notification";

/**
 * @param app {FileshareApp}
 * @param repository
 * @return {Promise<void>}
 */
async function delete_repository(app, repository) {
    const widget = require('./delete_repository.hbs')({name: repository.display_name.plain()}, {
        delete_repository: async (e) => {
            e.preventDefault();

            if (widget.hb_elements.repository.value !== repository.display_name.plain())
                return;

            const repositories = await app.fetch_api(`repository/delete`, 'POST',
                {
                    credentials: {
                        login: EncString.from_client(widget.hb_elements.login.value),
                        password: EncString.from_client(widget.hb_elements.password.value),
                    },
                    repositories: [repository.id]
                }
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le dépôt")));
            for (const repository_id of repositories) {
                await (await app.pool.remove_repository(repository_id));
            }

            app.get_modal().close();
        }
    });
    app.get_modal().open(widget, {custom_width: '500px', custom_height: '450px'})
}

export {delete_repository}