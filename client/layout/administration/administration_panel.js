import {LOCAL_USER} from "../../common/tools/user";
import {parse_fetch_result} from "../../common/widgets/message_box";
import {ClientString} from "../../common/tools/client_string";
import {humanFileSize, seconds_to_str} from "../../common/tools/utils";

const user_hbs = require('./user.hbs');
const repos_hbs = require('./repos.hbs');
const stats_hbs = require('./stats.hbs');

class AdministrationPanel {
    constructor(stat_div, user_list_div, repo_list_div) {
        this.stat_div = stat_div;
        this.user_list_div = user_list_div;
        this.repo_list_div = repo_list_div;
        this.refresh_data();
    }

    async refresh_data() {

        fetch(`/administration/stats/`, {
            headers: {
                'content-authtoken': LOCAL_USER.get_token(),
                'accept': 'application/json',
            },
        })
            .then(async (response) => await parse_fetch_result(response))
            .then((json) => {
                json.effective_size = humanFileSize(json.effective_size);
                json.size = humanFileSize(json.size);
                this.stat_div.append(stats_hbs(json, {}))
            });

        let user_list = new Map();

        await fetch(`/administration/userlist/`, {
            headers: {
                'content-authtoken': LOCAL_USER.get_token(),
                'accept': 'application/json',
            },
        })
            .then(async (response) => await parse_fetch_result(response))
            .then((json) => {
                for (let user of json) {
                    user_list.set(user.id, user);
                    this.user_list_div.append(user_hbs({
                        id: user.id,
                        name: new ClientString(user.name).plain(),
                        email: new ClientString(user.email).plain(),
                        is_guest: user.role === "guest",
                        is_vip: user.role === "vip",
                        is_admin: user.role === "admin",
                        allow_contact: user.allow_contact
                    }, {
                        set_role: async event => {
                            if (event.target.value === 'admin')
                                return;
                            await parse_fetch_result(await fetch('/administration/setrole',
                                {
                                    method: 'POST',
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        target: user.id,
                                        role: event.target.value
                                    })
                                }));
                        },
                        delete_user: event => {
                        },
                        reset_password: event => {
                        },
                    }));
                }
            });


        fetch(`/administration/reposlist/`, {
            headers: {
                'content-authtoken': LOCAL_USER.get_token(),
                'accept': 'application/json',
            },
        })
            .then(async (response) => await parse_fetch_result(response))
            .then((json) => {
                for (let repos of json) {
                    console.log(repos)
                    this.repo_list_div.append(repos_hbs({
                        id: repos.id,
                        name: new ClientString(repos.name).plain(),
                        display_name: new ClientString(repos.display_name).plain(),
                        owner: new ClientString(user_list.get(repos.owner).name).plain(),
                        description: new ClientString(repos.description).plain(),
                        status: repos.status,
                        visitor_file_lifetime: seconds_to_str(repos.visitor_file_lifetime),
                        max_file_size: humanFileSize(repos.max_file_size),
                        allow_visitor_upload: humanFileSize(repos.allow_visitor_upload),
                    }, {
                        delete_user: event => {
                        },
                        reset_password: event => {
                        },
                    }));
                }
            });

    }






}

window.administration = {AdministrationPanel}