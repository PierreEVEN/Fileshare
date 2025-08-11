import {Authentication} from "../tools/authentication/authentication";
import {AppWidget} from "../../../app_widget";
import {Filter} from "../../../types/filter/filter";
import {StateSelection} from "../../../utilities/state_selection";

require('./global_header.scss')

class AppHeader extends AppWidget {
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
                Authentication.login(this.get_app());
            },
            signup: () => {
                Authentication.signup(this.get_app());
            },
            logout: () => {
                Authentication.logout(this.get_app());
            },
            menu: () => {
                this.get_app().side_bar.show_mobile()
            },
            user: async () => {
                await this.get_app().state.select(new StateSelection().set_user(this._connected_user));
            },
            go_home: async () => {
                await this.get_app().state.select(new StateSelection());
            },
            search_changed: async (event) => {
                if (!event.key || event.key === 'Enter') {
                    if (event.target.value === "") {
                        this.get_app().set_global_search(null);
                    } else {
                        this.get_app().set_global_search(new Filter().name(event.target.value));
                    }
                }
            }
        });

        this.get_app().state.events.add('user_connected', async (data) => {
            this.refresh(data.new);
        });

        this._elements = div['hb_elements'];
        for (const element of div)
            this.append(element);

        this.refresh(this.get_app().state.connected_user())
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