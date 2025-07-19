import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../message_box/notification";
import {delete_user} from "../delete_user/delete_user";

require('./edit_user.scss')

/**
 * @param app {FileshareApp}
 * @param user {User}
 */
function edit_user(app, user) {
    let data = user.display_data();
    data.mask_email = !data.allow_contact;
    const widget = require('./edit_user.hbs')(data, {
        submit: async (e) => {
            e.preventDefault();
            let new_data = {
                id: user.id,
                login: EncString.from_client(widget.hb_elements.display_name.value),
                name: EncString.from_client(widget.hb_elements.url_name.value),
                allow_contact: !widget.hb_elements.mask_email.checked
            };
            await app.fetch_api(`user/update`, 'POST', new_data)
                .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de modifier le dépôt")));
            user.login = new_data.login;
            user.name = new_data.name;
            user.allow_contact = new_data.allow_contact;
            await user.refresh(app);
            app.get_modal().close();
        },
        delete: async () => {
            await delete_user(app, user);
        }
    });
    app.get_modal().open(widget, {custom_width: '800px', custom_height: '550px'})
}

export {edit_user}