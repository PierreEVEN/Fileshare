import {PAGE_CONTEXT} from "../../../common/tools/utils";
import {ClientString} from "../../../common/tools/client_string";
import {edit_repos} from "../edit_repos/edit_repos_form";

class ReposSettings {
    constructor(repos) {
        /**
         * @type {HTMLElement}
         */
        this.root = document.getElementById('repos-settings-root');

        this.repos = repos;
    }

    edit_settings() {
        const repos_data = JSON.parse(JSON.stringify(PAGE_CONTEXT.display_repos));
        repos_data.name = new ClientString(repos_data.name).plain();
        repos_data.description = new ClientString(repos_data.description).plain();
        repos_data.username = PAGE_CONTEXT.display_user.name;
        repos_data.display_name = new ClientString(repos_data.display_name).plain();
        edit_repos(repos_data);
    }
}

let REPOS_SETTINGS = null;

window.repos_settings = {
    load: () => {
        REPOS_SETTINGS = new ReposSettings(PAGE_CONTEXT.display_repos);
    },
    /**
     * @returns {ReposSettings}
     */
    get() {
        return REPOS_SETTINGS;
    }
};