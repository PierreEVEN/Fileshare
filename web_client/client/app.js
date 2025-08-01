
import './utilities/handlebars_helpers';
import "./modules/index/global_header/global_header";
import "./modules/index/viewport_pages/stats_viewport/stats_viewport";
import "./modules/index/viewport_pages/user_viewport/user_viewport";
import "./modules/index/tools/tree_button/item_tree_button";
import "./modules/index/tools/tree_button/repository_tree_button";
import "./modules/index/tools/tree_button/trash_tree_button";
import "./modules/index/viewport_pages/repository_settings/repository_settings";
import "./modules/index/side_bar/side_bar";
import "./modules/index/modal/modal";
import "./modules/index/viewport_pages/repository_viewport/upload/uploader";
import "./modules/index/viewport_pages/error_page";
import "./modules/index/viewport_pages/repository_viewport/repository_viewport";
import "./modules/index/side_bar/side_bar";

import {AppState} from "./utilities/state";
import {APP_COOKIES} from "./modules/index/tools/cookies/cookies";
import {Authentication} from "./modules/index/tools/authentication/authentication";
import {Message, NOTIFICATION} from "./modules/index/tools/message_box/notification";
import {ContentPool} from "./types/remote_filesystem/content_pool";
import {StateSelection} from "./utilities/state_selection";
import {InitData} from "./utilities/app_init_data";

require('./app.scss');

class FileshareApp extends HTMLElement {
    constructor() {
        super();
        /**
         * @type {ContentPool}
         */
        this.pool = new ContentPool(this);

        /**
         * @type {AppState}
         */
        this.state = new AppState(this);

        // Fetch init data
        const init_data = new InitData(this.pool, JSON.parse(document.body.dataset['app_config']));
        if (init_data.error)
            this.set_viewport_content(document.createElement('page-error').set_error(init_data.error));
        else
            init_data.apply_to_state(this.state);
        this._origin = init_data.origin;
    }

    connectedCallback() {
        if (!this._on_select_cb)
            this._on_select_cb = this.state.events.add('select', async selection => { await this._on_state_change(selection); })

        const layout = require('./app.hbs')({}, {
            close_mobile: () => {
                layout.hb_elements.side_bar.show_mobile();
            }
        });
        this._elements = layout['hb_elements'];
        for (const element of layout)
            this.append(element);

        this._elements.side_bar.events.add('show_mobile', (show) => {
            if (show)
                layout.hb_elements.mobile_bg.classList.add('selected')
            else
                layout.hb_elements.mobile_bg.classList.remove('selected')
            this._elements.app_header.update_burger_icon(show);
        });
        if (screen.availHeight > screen.availWidth)
            this._elements.side_bar.show_mobile();

        this.side_bar = this._elements.side_bar;
    }

    disconnectedCallback() {
        if (this._on_select_cb)
            this._on_select_cb.remove();
        delete this._on_select_cb;
    }

    /**
     * @param selection {StateSelection}
     * @private
     */
    async _on_state_change(selection) {
        if (selection.item) {
            this._get_repository_page();
        } else if (selection.repository) {
            if (selection.in_settings)
                this.set_viewport_content(document.createElement('page-repository-settings').set_repository(selection.repository));
            else
                this._get_repository_page()
        } else if (selection.user)
            this.set_viewport_content(document.createElement('page-user').set_user(selection.user));
        else if (selection.in_admin_pannel)
            this.set_viewport_content(document.createElement('page-stats'));
        else
            this.set_viewport_content(null);
    }

    /**
     * @returns {RepositoryViewport}
     * @private
     */
    _get_repository_page() {
        if (this._viewport_content && this._viewport_content.tagName.toLowerCase() === 'page-repository') {
            return this._viewport_content;
        } else {
            return this.set_viewport_content(document.createElement('page-repository'));
        }
    }

    set_viewport_content(page_content) {
        if (this._viewport_content) {
            this._viewport_content.remove();
            delete this._viewport_content;
        }
        this._viewport_content = page_content;
        if (this._viewport_content)
            this._elements.viewport.append(this._viewport_content);
        return page_content;
    }

    origin() {
        return this._origin;
    }

    /**
     * @param path
     * @param method
     * @param body
     * @param custom_token
     * @returns {Promise<object|object[]|any>}
     */
    async fetch_api(path, method = 'GET', body = null, custom_token = null) {
        const headers = new Headers();
        if (body)
            headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        headers.append('content-authtoken', custom_token ? custom_token : APP_COOKIES.get_token());
        const result = await fetch(`${this.origin()}/api/${path}`, {
            method: method,
            body: body ? JSON.stringify(body) : null,
            headers: headers
        });
        if (result.status === 401) {
            await Authentication.login(this).then(async () => await this.fetch_api(path, method, body))
        } else {
            if (result.status.toString().startsWith("2")) {
                let text = await result.text();
                try {
                    return JSON.parse(text);
                } catch (err) {
                    return text;
                }
            }
        }
        throw {message: `${await result.text()}`, code: result.status}
    }

    /**
     * @returns {GlobalCarousel}
     */
    get_carousel() {
        if (!this._carousel) {
            this._carousel = document.createElement('global-carousel');
            this.append(this._carousel);
        }
        return this._carousel;
    }

    set_global_search(filter) {
        if (this._viewport_content && this._viewport_content.tagName.toLowerCase() === 'page-repository') {
            this._viewport_content.set_search_filter(filter);
        } else {
            NOTIFICATION.error(new Message("Filter for repositories is not implemented yet").title("Please select a repository first"))
        }
    }

    /**
     * @returns {ModalContainer}
     */
    get_modal() {
        if (!this._modal) {
            this._modal = document.createElement('modal-container');
            this.append(this._modal);
        }
        return this._modal;
    }
}

customElements.define("fileshare-app", FileshareApp);