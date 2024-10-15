import {MODAL} from "../../modal/modal";
import {fetch_api} from "../../../../utilities/request";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";
import {delete_user} from "../delete_user/delete_user";

require('./edit_user.scss')

/**
 * @param user {User}
 */
function edit_user(user) {
    let data = user.display_data();
    data.mask_email = !data.allow_contact;
    const widget = require('./edit_user.hbs')(data, {
        submit: async (e) => {
            e.preventDefault();
            let new_data = {
                id: user.id,
                login: EncString.from_client(document.getElementById('display_name').value),
                name: EncString.from_client(document.getElementById('url_name').value),
                allow_contact: !document.getElementById('mask_email').checked
            };

            await fetch_api(`user/update/`, 'POST', new_data)
                .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de modifier le dépôt")));

            user.login = new_data.login;
            user.name = new_data.name;
            user.allow_contact = new_data.allow_contact;
            await user.refresh();

            MODAL.close();
        },
        delete: async () => {
            await delete_user(user);
        }
    });
    MODAL.open(widget, {custom_width: '800px', custom_height: '550px'})
}

export {edit_user}