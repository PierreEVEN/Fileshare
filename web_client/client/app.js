import './utilities/handlebars_helpers';
//@FIX : don't importing this cause a weird issue when rendering pdf...
require('./modules/embed_viewers/custom_elements/pdf_viewer/pdf-viewer.hbs');
require('./modules/embed_viewers/custom_elements/document/code');
require('./modules/embed_viewers/custom_elements/document/markdown');
require('./modules/embed_viewers/custom_elements/pdf_viewer/pdf-viewer');
require('./app.scss');

import "./modules/index/global_header/global_header";
import "./modules/index/viewport_pages/stats_viewport/stats_viewport";
import "./modules/index/viewport_pages/user_viewport/user_viewport";
import "./modules/index/viewport_pages/repository_settings/repository_settings";
import "./modules/index/side_bar/side_bar";
require("./modules/index/modal/modal");

import "./modules/index/viewport_pages/repository_viewport/upload/uploader";
import {State} from "./utilities/state";
import {Repository} from "./types/repository";
import {AppConfig} from "./utilities/app_config";
import {FilesystemItem} from "./types/filesystem_stream";
import "./modules/index/viewport_pages/error_page";
import "./modules/index/viewport_pages/repository_viewport/repository_viewport";
import {APP_COOKIES} from "./modules/index/tools/cookies/cookies";
import {Authentication} from "./modules/index/tools/authentication/authentication";
import {SIDE_BAR} from "./modules/index/side_bar/side_bar";

class FileshareApp extends HTMLElement {
    constructor() {
        super();

        this.state = new State(this);

        /**
         * @type {AppConfig}
         */
        this.app_config = new AppConfig(this);

    }

    connectedCallback() {
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
        });

        this._elements.side_bar.events.add('show_mobile', (show) => {
            this._elements.app_header.update_burger_icon(show);
        });


        (async () => {
            if (this.app_config.error())
                this.set_viewport_content(document.createElement('page-error').set_error(this.app_config.error()));
            else {
                if (this.app_config.show_stats()) {
                    this.set_viewport_content(document.createElement('page-stats'));
                } else if (await this.app_config.display_item()) {
                    await this.set_display_item(await this.app_config.display_item());
                    await this._elements.side_bar.expand_to(this.app_config.display_repository(), await this.app_config.display_item(), false);
                } else if (this.app_config.display_repository()) {
                    await this._elements.side_bar.expand_to(this.app_config.display_repository(), null, this.app_config.in_trash());
                    if (this.app_config.in_trash())
                        await this.set_display_trash(this.app_config.display_repository());
                    else if (this.app_config.repository_settings()) {
                        await this.state.open_repository_settings(this.app_config.display_repository());
                        this.set_display_repository_settings(this.app_config.display_repository());
                    }
                    else
                        await this.set_display_repository(this.app_config.display_repository());
                }
                else if (this.app_config.display_user()) {
                    this.set_display_user(this.app_config.display_user());
                } else {
                    if (screen.availHeight > screen.availWidth)
                        await this._elements.side_bar.show_mobile();
                    if (this.app_config.connected_user())
                        await this._elements.side_bar.expand_my_repositories(true);
                    else
                        await this._elements.side_bar.expand_recent(true);
                }
            }
        })().catch(error => console.error(`initialization failed :`, error));
    }

    /**
     * @param repository {Repository}
     * @return {Promise<void>}
     */
    async set_display_repository(repository) {
        await this.get_repository_page().open_root(repository);
        await this.state.open_repository(repository);
    }

    /**
     * @param item {FilesystemItem}
     * @return {Promise<void>}
     */
    async set_display_item(item) {
        const repository = await Repository.find(this, item.repository);
        await this.get_repository_page().open_item(item);
        await this.state.open_item(item);
        this.get_repository_page(repository);
    }

    /**
     * @param repository {Repository}
     * @return {Promise<void>}
     */
    async set_display_trash(repository) {
        await this.get_repository_page().open_trash(repository);
        await this.state.open_trash(repository);
    }

    get_repository_page() {
        if (this._viewport_content && this._viewport_content.tagName.toLowerCase() === 'page-repository') {
            return this._viewport_content;
        } else {
            return this.set_viewport_content(document.createElement('page-repository'));
        }
    }
    set_display_user(new_user) {
        this.set_viewport_content(document.createElement('page-user').set_user(new_user));
    }

    set_display_repository_settings(repository) {
        this.set_viewport_content(document.createElement('page-repository-settings').set_repository(repository));
    }

    set_viewport_content(page_content) {
        if (this._viewport_content) {
            this._viewport_content.remove();
            delete this._viewport_content;
        }
        this._viewport_content = page_content;
        this._elements.viewport.append(this._viewport_content);
        return page_content;
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
        const result = await fetch(`${get_app(this).app_config.origin()}/api/${path}`, {
            method: method,
            body: body ? JSON.stringify(body) : null,
            headers: headers
        });
        if (result.status === 401) {
            let error = false;
            await Authentication.login(this)
                .catch(() => {
                    error = true;
                });
            if (!error) {
                return await this.fetch_api(path, method, body);
            }
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

/**
 * @param context {HTMLElement}
 * @return {FileshareApp}
 */
function get_app(context) {
    if (!context)
        console.error("Cannot get app : invalid context");
    let app = context.closest && context.closest('fileshare-app')
    if (!app)
        console.error("Cannot get app : Cannot find app from context");
    return app;
}


export {get_app}