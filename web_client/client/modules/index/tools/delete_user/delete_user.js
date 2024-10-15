import {fetch_api} from "../../../../utilities/request";
import {MODAL} from "../../modal/modal";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";

/**
 * @param user {User}
 * @return {Promise<void>}
 */
async function delete_user(user) {
    const widget = require('./delete_user.hbs')({login: user.login.plain()}, {
        delete_user: async (e) => {
            e.preventDefault();

            if (widget.elements.login.value !== user.login.plain())
                return;

            await fetch_api(`user/delete/`, 'POST',
                {
                    login: EncString.from_client(widget.elements.login.value),
                    password: EncString.from_client(widget.elements.password.value)
                }
            ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le compte")));

            user.remove();

            MODAL.close();
        }
    });
    MODAL.open(widget, {custom_width: '500px', custom_height: '450px'})
}

export {delete_user}