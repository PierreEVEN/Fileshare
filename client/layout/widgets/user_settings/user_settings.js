import {PAGE_CONTEXT} from "../../../common/tools/utils";

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

    go_to_user(button) {
        this.clear_page();
        button.classList.add('selected');
        document.getElementById('user-settings-container').append(user_infos_hbs(this.user, {}))
    }

    go_to_repos(button) {
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