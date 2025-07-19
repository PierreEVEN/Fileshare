import {Authentication} from "../tools/authentication/authentication";
import {SIDE_BAR} from "../side_bar/side_bar";
import {get_app} from "../../../app";
import {GLOBAL_EVENTS} from "../../../types/event_manager";

require('./global_header.scss')

class AppHeader extends HTMLElement{
    constructor() {
        super();
        /**
         * @type {User}
         * @private
         */
        this._connected_user = undefined;
    }

    connectedCallback() {
        const div = require('./global_header.hbs')({}, {
            login: () => {
                Authentication.login(this);
            },
            signup: () => {
                Authentication.signup(this);
            },
            logout: () => {
                Authentication.logout(this);
            },
            menu: () => {
                SIDE_BAR.show_mobile()
            },
            user: async () => {
                await get_app(this).set_display_user(this._connected_user);
            }
        });

        GLOBAL_EVENTS.add('on_connected_user_changed', async (data) => {
            this.refresh(data.new);
        });

        this._elements = div['hb_elements'];
        for (const element of div)
            this.append(element);

        this.refresh(get_app(this).app_config.connected_user())
    }

    update_burger_icon(show) {
        if (show) {
            this._elements.menu_img.src = "/public/images/icons/icons8-expand-50.png";
            this._elements.menu_img.style.transform = 'rotate(90deg)';
        }
        else {
            this._elements.menu_img.src = "/public/images/icons/icons8-menu-96.png";
            this._elements.menu_img.style.transform = 'unset';
        }
    }

    refresh(connected_user) {
        if (connected_user !== this._connected_user) {
            this._connected_user = connected_user;
            if (connected_user) {
                this._elements.user.style.display = "flex";
                this._elements.signin.style.display = "none";
                this._elements.username.innerText = connected_user.login.plain().substring(0, 4) + '..';
            }
            else {
                this._elements.user.style.display = "none";
                this._elements.signin.style.display = "flex";}
        }
    }
}

customElements.define("app-header", AppHeader);