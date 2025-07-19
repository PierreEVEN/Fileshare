import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";

/**
 * @param app {FileshareApp}
 * @param user {User}
 * @return {Promise<void>}
 */
async function delete_user(app, user) {
    const widget = require('./delete_user.hbs')({login: user.login.plain()}, {
        delete_user: async (e) => {
            e.preventDefault();

            if (widget.hb_elements.login.value !== user.login.plain())
                return;

            await app.fetch_api(`user/delete`, 'POST',
                {
                    login: EncString.from_client(widget.hb_elements.login.value),
                    password: EncString.from_client(widget.hb_elements.password.value)
                }
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le compte")));

            user.remove(app);

            app.get_modal().close();
        }
    });
    app.get_modal().open(widget, {custom_width: '500px', custom_height: '450px'})
}

export {delete_user}