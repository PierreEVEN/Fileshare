import {Message, NOTIFICATION} from "../../tools/message_box/notification";
import {User} from "../../../../types/remote_filesystem/user";
import {edit_user} from "../../tools/edit_user/edit_user";
import {APP_COOKIES} from "../../tools/cookies/cookies";
import {human_readable_timestamp} from "../../../../utilities/utils";
import {AppWidget} from "../../../../app_widget";
import {StateSelection} from "../../../../utilities/state_selection";
import {ContentRequest} from "../../../../types/remote_filesystem/content_request";

require('./user_settings.scss')

class UserViewport extends AppWidget {
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

        this._connected_user_event = this.get_app().state.events.add('user_connected', async (change) => {
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
            is_self: this.user === this.get_app().state.connected_user(),
            is_admin
        }, {
            edit: async () => {
                await edit_user(this.get_app(), this.user);
            },
            admin: async () => {
                await this.get_app().state.select(new StateSelection().set_admin())
            }
        });
        for (const element of viewport)
            this.append(element);
        this._elements = viewport.hb_elements;

        const repository_ids = await this.get_app().fetch_api(`user/repositories/${this.user.id}`)
            .catch(err => {
            NOTIFICATION.warn(new Message(err).title("Failed to retrieve user repositories"));
            return [];
        });
        await this.get_app().pool.fetch_content(new ContentRequest().repository(repository_ids));

        for (const repository of repository_ids) {
            this._elements.repository_list.append(document.createElement('repository-tree-button').set_repository(this.get_app().pool.find_repository(repository)));
        }

        if (this.user === this.get_app().state.connected_user()) {
            let tokens = await this.get_app().fetch_api('user/tokens')
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
                        await this.get_app().fetch_api('user/logout', 'POST', null, token.token)
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
