import {Authentication} from "../../modals/authentication/authentication";
import {AppWidget} from "../../../src/app_widget";
import {Filter} from "../../../src/filter/filter";
import {StateSelection} from "../../../src/state/state_selection";

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
        this.set_content(require('./global_header.hbs'), {}, {
            login: async () => {
                await Authentication.login(this.get_app());
            },
            signup: async () => {
                await Authentication.signup(this.get_app());
            },
            logout: async () => {
                await Authentication.logout(this.get_app());
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
                        const selection = this.get_app().state.selection();
                        const filter = new Filter()
                            .name(event.target.value)
                            .source(selection.repository ? selection.repository.id : selection.item.repository, selection.item ? selection.item.id : null);
                        this.get_app().set_global_search(filter);
                        await this.get_app().state.select(new StateSelection().set_filter(filter));
                        console.error("TODO FILTER");
                    }
                }
            }
        });

        this.get_app().state.events.add('user_connected', async (data) => {
            this.refresh(data.new);
        });

        this.refresh(this.get_app().state.connected_user())
    }

    update_burger_icon(show) {
        if (show) {
            this.elements().menu_img.src = "/public/images/icons/icons8-expand-50.png";
            this.elements().menu_img.style.transform = 'rotate(90deg)';
        }
        else {
            this.elements().menu_img.src = "/public/images/icons/icons8-menu-96.png";
            this.elements().menu_img.style.transform = 'unset';
        }
    }

    refresh(connected_user) {
        if (connected_user !== this._connected_user) {
            this._connected_user = connected_user;
            if (connected_user) {
                this.elements().user.style.display = "flex";
                this.elements().signin.style.display = "none";
                this.elements().username.innerText = connected_user.login.plain().substring(0, 4) + '..';
            }
            else {
                this.elements().user.style.display = "none";
                this.elements().signin.style.display = "flex";
            }
        }
    }
}

customElements.define("app-header", AppHeader);