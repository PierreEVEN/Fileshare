import {edit_repository} from "../../tools/edit_repository/edit_repository";
import {EncString} from "../../../../types/encstring";
import {Message, NOTIFICATION} from "../../tools/message_box/notification";
import {User} from "../../../../types/remote_filesystem/user";
import {humanFileSize} from "../../../../utilities/utils";
import {AppWidget} from "../../../../app_widget";

require('./repository_settings.scss')

class RepositorySettings extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_repository(this.repository);
    }

    set_repository(repository) {
        this.repository = repository;

        if (!this.isConnected)
            return this;

        this.innerHTML = '';
        if (!repository)
            return this;


        this.get_app().fetch_api(`repository/stats`, 'POST', repository.id)
            .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de lire les informations du dépôt")))
            .then(async (data) => {
                let merged_data = repository.display_data();
                merged_data.total_count = data.items;
                merged_data.total_dirs = data.directories;
                merged_data.total_size = humanFileSize(data.size);
                merged_data.trash_count = data.trash_items;
                merged_data.trash_dirs = data.trash_directories;
                merged_data.trash_size = humanFileSize(data.trash_size);

                merged_data.num_extensions = data.extensions.length;
                merged_data.extensions = [];
                for (const extension of data.extensions.sort((a, b) => { return b.total_size / b.count - a.total_size / a.count }))
                    merged_data.extensions.push({
                        name: (new EncString(extension.mimetype)).plain(),
                        count: extension.count,
                        size: humanFileSize(extension.total_size)
                    })
                merged_data.num_contributors = data.contributors.length;
                merged_data.contributors = [];
                for (const contributor of data.contributors)
                    merged_data.contributors.push({
                        name: (await this.get_app().pool.fetch_user(contributor.id)).login.plain(),
                        count: contributor.count
                    });

                const div = require('./repository_settings.hbs')(merged_data, {
                    edit: async () => {
                        edit_repository(this.get_app(), repository);
                    },
                    add_user: () => {
                        const widget = require('./add_authorization.hbs')({}, {
                            add: async (e) => {
                                e.preventDefault();

                                let user = await User.search_from_name(this.get_app(), EncString.from_client(widget.hb_elements.username.value), true);
                                if (user.length === 0) {
                                    NOTIFICATION.error(new Message(`Impossible de trouver l'utilisateur '${widget.hb_elements.username.value}'`));
                                    return;
                                }
                                await this._register_subscription(repository.id, user[0].id, widget.hb_elements.access_type.value);
                                this.get_app().get_modal().close();
                            }
                        });
                        this.get_app().get_modal().open(widget, {custom_width: '600px', custom_height: '350px'})
                    }
                });
                this.hb_elements = div.hb_elements;

                for (const element of div)
                    this.append(element);

                this.get_app().fetch_api(`repository/subscriptions`, 'POST', repository.id).then(async subscriptions => {
                    for (const subscription of subscriptions) {
                        await this._add_subscription(subscription);
                    }
                }).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible d'ajouter l'utilisateur")));
            });
        return this;
    }

    async _add_subscription(data) {
        let user = await this.get_app().pool.fetch_user(data.owner);
        const auth_widget = require('./authorization.hbs')({
            name: user.login.plain(),
            access_type: data.access_type,
            is_read_only: data.access_type === 'ReadOnly',
            is_contributor: data.access_type === 'Contributor',
            is_moderator: data.access_type === 'Moderator',
        }, {
            remove: async () => {
                await this._remove_subscription(data.repository, data.owner);
                auth_widget.remove();
            },
            set_access_type: async () => {
                await this._remove_subscription(data.repository, data.owner);
                await this._register_subscription(data.repository, data.owner, auth_widget.hb_elements.access_type.value);
                auth_widget.remove();
            }
        });
        this.hb_elements.subscriptions.append(auth_widget);
    }

    async _register_subscription(repository, owner, access_type) {
        const data = {
            repository: repository,
            users: [{
                user: owner,
                access_type: access_type
            }]
        };
        let subscriptions = await this.get_app().fetch_api(`repository/subscribe`, 'POST', data)
            .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible d'ajouter l'utilisateur")));
        for (const subscription of subscriptions) {
            await this._add_subscription(subscription);
        }
    }

    async _remove_subscription(repository, owner) {
        await this.get_app().fetch_api(`repository/unsubscribe`, 'POST', {
            repository: repository,
            users: [owner]
        }).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible d'ajouter l'utilisateur")));
    }

    delete() {
        super.delete();
    }
}

customElements.define("page-repository-settings", RepositorySettings);
