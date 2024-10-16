import {MemoryTracker} from "../../../../types/memory_handler";
import {fetch_api} from "../../../../utilities/request";
import {Message, NOTIFICATION} from "../../tools/message_box/notification";
import {Repository} from "../../../../types/repository";
import {User} from "../../../../types/user";
import {APP} from "../../../../app";
import {edit_user} from "../../tools/edit_user/edit_user";
import {APP_CONFIG} from "../../../../types/app_config";
import {APP_COOKIES} from "../../../../utilities/cookies";
import {GLOBAL_EVENTS} from "../../../../types/event_manager";
import {human_readable_timestamp} from "../../../../utilities/utils";

require('./user_settings.scss')

class UserViewport extends MemoryTracker {
    /**
     * @param user {User}
     * @param container {HTMLElement}
     */
    constructor(user, container) {
        super(UserViewport);
        this.user = user;
        this.container = container;
        this._fill_data();
        this._refresh_event = this.user.events.add('refresh', async () => {
            await this._fill_data();
        });

        this._connected_user_event = GLOBAL_EVENTS.add('on_connected_user_changed', async (change) => {
            if (change.old === user || change.new === user) {
                await this._fill_data();
            }
        })
    }

    delete() {
        super.delete();
        this._refresh_event.remove();
        this._refresh_event = null;
        this._connected_user_event.remove();
        this._connected_user_event = null;
    }

    async _fill_data() {
        this.container.innerHTML = '';
        let viewport = require('./user_viewport.hbs')({
            user: this.user.display_data(),
            is_self: this.user === APP_CONFIG.connected_user()
        }, {
            edit: async () => {
                await edit_user(this.user);
            }
        });
        this.container.append(viewport);
        this._elements = viewport.elements;

        let repositories = await fetch_api(`user/repositories/${this.user.id}/`)
            .catch(err => {
                NOTIFICATION.warn(new Message(err).title("Failed to retrieve user repositories"));
                return [];
            });

        for (const repository_id of repositories) {
            let repository = await Repository.find(repository_id);
            let widget = require('./user_repository.hbs')({text: repository.display_name.plain()}, {
                visit: async () => {
                    APP.set_display_repository(repository);
                }
            });
            this._elements.repository_list.append(widget);
        }

        if (this.user === APP_CONFIG.connected_user()) {
            let tokens = await fetch_api('user/tokens/')
                .catch(err => {
                    NOTIFICATION.warn(new Message(err).title("Failed to retrieve user tokens"));
                    return [];
                });
            for (const token of tokens) {
                if (token.token === APP_COOKIES.get_token())
                    continue;
                const div = require('./token.hbs')({
                    device: decodeURIComponent(token.device),
                    expdate: human_readable_timestamp(token.expdate),
                }, {
                    delete: async () => {
                        await fetch_api('user/logout/', 'POST', null, token.token)
                            .catch(err => {
                                NOTIFICATION.warn(new Message(err).title("Failed to delete token"));
                                return [];
                            });
                        div.remove();
                    }
                })
                this._elements.tokens.append(div);
            }
        }
    }
}

export {UserViewport}