import {Message, NOTIFICATION} from "../../tools/message_box/notification";
import {Repository} from "../../../../types/repository";
import {User} from "../../../../types/user";
import {get_app} from "../../../../app";
import {edit_user} from "../../tools/edit_user/edit_user";
import {APP_COOKIES} from "../../tools/cookies/cookies";
import {GLOBAL_EVENTS} from "../../../../types/event_manager";
import {human_readable_timestamp} from "../../../../utilities/utils";

require('./user_settings.scss')

class UserViewport extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_user(this.user);
    }

    /**
     * @param user {User}
     * @returns {UserViewport}
     */
    set_user(user) {
        this.user = user;
        if (!this.isConnected)
            return this;
        this.innerHTML = '';
        if (!user)
            return this;

        this.user = user;
        this._fill_data();
        this._refresh_event = this.user.events.add('refresh', async () => {
            await this._fill_data();
        });

        this._connected_user_event = GLOBAL_EVENTS.add('on_connected_user_changed', async (change) => {
            if (change.old === user || change.new === user) {
                await this._fill_data();
            }
        })
        return this;
    }

    delete() {
        super.delete();
        this._refresh_event.remove();
        this._refresh_event = null;
        this._connected_user_event.remove();
        this._connected_user_event = null;
    }

    async _fill_data() {
        this.innerHTML = '';
        const is_admin = this.user.user_role.toString() === "Admin";
        let viewport = require('./user_viewport.hbs')({
            user: this.user.display_data(),
            is_self: this.user === get_app(this).app_config.connected_user(),
            is_admin
        }, {
            edit: async () => {
                await edit_user(this.user, this);
            }
        });
        for (const element of viewport)
            this.append(element);
        this._elements = viewport.hb_elements;

        let repositories = await get_app(this).fetch_api(`user/repositories/${this.user.id}`)
            .catch(err => {
                NOTIFICATION.warn(new Message(err).title("Failed to retrieve user repositories"));
                return [];
            });

        for (const repository_id of repositories) {
            let repository = await Repository.find(this, repository_id);
            let widget = require('./user_repository.hbs')({text: repository.display_name.plain()}, {
                visit: async () => {
                    await get_app(this).set_display_repository(repository);
                }
            });
            this._elements.repository_list.append(widget);
        }

        if (this.user === get_app(this).app_config.connected_user()) {
            let tokens = await get_app(this).fetch_api('user/tokens')
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
                        await get_app(this).fetch_api('user/logout', 'POST', null, token.token)
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

customElements.define("page-user", UserViewport);
