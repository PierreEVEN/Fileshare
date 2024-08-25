import {PAGE_CONTEXT} from "../../../common/tools/utils";
import {ClientString} from "../../../common/tools/client_string";
import {edit_repos} from "../edit_repos/edit_repos_form";
import {parse_fetch_result, print_message} from "../components/message_box";
import {close_modal, open_modal} from "../components/modal";
import {LOCAL_USER} from "../../../common/tools/user";

const authorization_hbs = require('./authorization.hbs')
const add_authorization_hbs = require('./add_authorization.hbs')
require('./repos_settings.scss')

class ReposSettings {
    constructor(repos) {
        /**
         * @type {HTMLElement}
         */
        this.root = document.getElementById('repos-settings-root');

        this.repos = repos;

        this.fill_authorizations();
    }

    async fill_authorizations() {
        const authorizations = await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/authorizations/`));
        if (authorizations.message)
            return;

        const authorizations_div = document.getElementById('repos-settings-authorizations');
        authorizations_div.innerText = '';
        for (const authorization of authorizations) {
            const authorization_div = authorization_hbs({
                username: new ClientString(authorization.owner.name).plain(),
                root_item: authorization.root_item ? new ClientString(authorization.root_item.name).plain() : null,
                access_type: authorization.access_type,
                is_read_only: authorization.access_type === 'read-only',
                is_contributor: authorization.access_type === 'contributor',
                is_moderator: authorization.access_type === 'moderator'
            }, {
                set_access_type: async (e) => {
                    await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/update-authorization/`,
                        {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                owner: authorization.owner.id,
                                repos: authorization.repos,
                                root_item: authorization.root_item ? authorization.root_item.id : null,
                                access_type: e.target.value
                            })
                        }));
                },
                remove: async (e) => {
                    await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/update-authorization/`,
                        {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                owner: authorization.owner.id,
                                repos: authorization.repos,
                                root_item: authorization.root_item ? authorization.root_item.id : null,
                                remove: true
                            })
                        }));
                    e.target.parentElement.remove()
                }
            });
            authorizations_div.append(authorization_div)
        }
    }

    add_authorization() {
        open_modal(add_authorization_hbs({}, {
            add: async (e) => {
                e.preventDefault();
                if (!document.getElementById('username').validity.valid) {
                    await print_message('error', 'Nom d\'utilsiateur invalide', 'veuillez spécifier un utilisateur valide');
                    return;
                }

                const res = await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/add-authorization/`,
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            owner: ClientString.FromClient(document.getElementById('username').value),
                            root_item: null,
                            access_type: document.getElementById('access_type').value
                        })
                    }));
                if (!res.message)
                    window.location.reload();
             }
        }), '500px', '300px', 'auth');
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