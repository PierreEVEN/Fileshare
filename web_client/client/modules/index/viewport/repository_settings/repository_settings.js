import {MemoryTracker} from "../../../../types/memory_handler";
import {edit_repository} from "../../tools/edit_repository/edit_repository";
import {EncString} from "../../../../types/encstring";
import {fetch_api} from "../../../../utilities/request";
import {Message, NOTIFICATION} from "../../tools/message_box/notification";
import {MODAL} from "../../modal/modal";
import {User} from "../../../../types/user";
import {humanFileSize} from "../../../../utilities/utils";

require('./repository_settings.scss')

class RepositorySettings extends MemoryTracker {
    /**
     * @param repository {Repository}
     * @param container {HTMLElement}
     */
    constructor(repository, container) {
        super(RepositorySettings);
        this.repository = repository;
        this.container = container;


        this.container.innerHTML = '';

        fetch_api(`repository/stats/`, 'POST', repository.id)
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
                for (const extension of data.extensions)
                    merged_data.extensions.push({
                        name: (new EncString(extension.mimetype)).plain(),
                        count: extension.count
                    })
                merged_data.num_contributors = data.contributors.length;
                merged_data.contributors = [];
                for (const contributor of data.contributors)
                    merged_data.contributors.push({
                        name: (await User.fetch(contributor.id)).login.plain(),
                        count: contributor.count
                    });

                this.div = require('./repository_settings.hbs')(merged_data, {
                    edit: async () => {
                        edit_repository(repository);
                    },
                    add_user: () => {
                        const widget = require('./add_authorization.hbs')({}, {
                            add: async (e) => {
                                e.preventDefault();

                                let user = await User.search_from_name(EncString.from_client(document.getElementById('username').value), true);
                                if (user.length === 0) {
                                    NOTIFICATION.error(new Message(`Impossible de trouver l'utilisateur '${document.getElementById('username').value}'`));
                                    return;
                                }
                                await this._register_subscription(repository.id, user[0].id, document.getElementById('access_type').value);
                                MODAL.close();
                            }
                        });
                        MODAL.open(widget, {custom_width: '600px', custom_height: '350px'})
                    }
                });

                this.container.append(this.div);

                fetch_api(`repository/subscriptions/`, 'POST', repository.id).then(async subscriptions => {
                    for (const subscription of subscriptions) {
                        await this._add_subscription(subscription);
                    }
                }).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible d'ajouter l'utilisateur")));
            });
    }

    async _add_subscription(data) {
        let user = await User.fetch(data.owner);
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
                await this._register_subscription(data.repository, data.owner, auth_widget.elements.access_type.value);
                auth_widget.remove();
            }
        });
        this.div.elements.subscriptions.append(auth_widget);
    }

    async _register_subscription(repository, owner, access_type) {
        const data = {
            repository: repository,
            users: [{
                user: owner,
                access_type: access_type
            }]
        };
        let subscriptions = await fetch_api(`repository/subscribe/`, 'POST', data)
            .catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible d'ajouter l'utilisateur")));
        for (const subscription of subscriptions) {
            await this._add_subscription(subscription);
        }
    }

    async _remove_subscription(repository, owner) {
        await fetch_api(`repository/unsubscribe/`, 'POST', {
            repository: repository,
            users: [owner]
        }).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible d'ajouter l'utilisateur")));
    }

    delete() {
        super.delete();
    }
}


export {RepositorySettings}