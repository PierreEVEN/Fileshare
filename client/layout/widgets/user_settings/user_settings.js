import {human_readable_timestamp, object_to_decoded_string, PAGE_CONTEXT} from "../../../common/tools/utils";
import {parse_fetch_result, print_message} from "../components/message_box";
import {ClientString} from "../../../common/tools/client_string";

require('./user_settings.scss')

const user_infos_hbs = require('./user_infos.hbs')

class UserSettings {
    constructor(user) {
        /**
         * @type {HTMLElement}
         */
        this.root = document.getElementById('user-settings-root');

        this.user = user;
    }

    clear_page() {
        for (const button of document.getElementsByClassName('setting-button'))
            button.classList.remove('selected')
        document.getElementById('user-settings-container').innerHTML = ''
    }

    async go_to_user(button) {
        this.clear_page();
        button.classList.add('selected');

        const tokens = await parse_fetch_result(await fetch(`${PAGE_CONTEXT.user_path()}/user-token-list/`));
        for (const token of tokens) {
            token.device = decodeURIComponent(token.device);
            token.expdate = human_readable_timestamp(token.expdate)
        }
        document.getElementById('user-settings-container').append(user_infos_hbs({
            user: object_to_decoded_string(this.user),
            tokens: tokens
        }, {
            reset_password: async () => {
                const res = await parse_fetch_result(await fetch(`/api/reset-password/`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({email: ClientString.FromClient(this.user.email)})
                }));
                if (!res.message)
                    print_message('info', 'Mail de réinitialisation envoyé', 'Vérifiez votre boite mail pour poursuivre la procédure de réinitialisation');
            }
        }))
    }

    async delete_auth_token(button) {
        const res = await parse_fetch_result(await fetch(`/api/delete-authtoken/${button.getAttribute('token')}`, {
            method: 'POST'
        }));
        if (!res.message)
            button.parentElement.remove();
    }

    async go_to_repos(button) {
        this.clear_page();
        button.classList.add('selected');
    }
}

let USER_SETTINGS = null;

window.user_settings = {
    load: () => {
        USER_SETTINGS = new UserSettings(PAGE_CONTEXT.connected_user);
    },
    /**
     * @returns {UserSettings}
     */
    get() {
        return USER_SETTINGS;
    }
};