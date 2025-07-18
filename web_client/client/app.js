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
import {SIDE_BAR} from "./modules/index/side_bar/side_bar";

import "./modules/index/viewport_pages/repository_viewport/upload/uploader";
import {State} from "./utilities/state";
import {Repository} from "./types/repository";
import {APP_CONFIG} from "./types/app_config";
import {FilesystemItem} from "./types/filesystem_stream";
import "./modules/index/viewport_pages/error_page";
import "./modules/index/viewport_pages/repository_viewport/repository_viewport";

let APP = null;

class FileshareApp extends HTMLElement {
    constructor() {
        super();
        APP = this;
    }

    connectedCallback() {
        /**
         * @type {HTMLElement}
         * @private
         */
        const layout = require('./app.hbs')({}, {
            close_mobile: () => {
                SIDE_BAR.show_mobile();
            }
        });
        for (const element of layout)
            this.append(element);

        /**
         * @type {object}
         * @private
         */
        this._elements = layout['hb_elements'];

        SIDE_BAR.events.add('show_mobile', (show) => {
            if (show)
                layout.hb_elements.mobile_bg.classList.add('selected')
            else
                layout.hb_elements.mobile_bg.classList.remove('selected')
        })

        this.state = new State(this);

        (async () => {
            if (APP_CONFIG.error())
                this.set_viewport_content(document.createElement('page-error').set_error(APP_CONFIG.error()));
            else {
                if (APP_CONFIG.show_stats()) {
                    this.set_viewport_content(document.createElement('page-stats'));
                } else if (await APP_CONFIG.display_item()) {
                    await this.set_display_item(await APP_CONFIG.display_item());
                    await SIDE_BAR.expand_to(APP_CONFIG.display_repository(), await APP_CONFIG.display_item(), false);
                } else if (APP_CONFIG.display_repository()) {
                    await SIDE_BAR.expand_to(APP_CONFIG.display_repository(), null, APP_CONFIG.in_trash());
                    if (APP_CONFIG.in_trash())
                        await this.set_display_trash(APP_CONFIG.display_repository());
                    else if (APP_CONFIG.repository_settings()) {
                        await this.state.open_repository_settings(APP_CONFIG.display_repository());
                        this.set_viewport_content(document.createElement('page-repository-settings').set_repository(APP_CONFIG.display_repository()));
                    }
                    else
                        await this.set_display_repository(APP_CONFIG.display_repository());
                } else if (APP_CONFIG.display_user()) {
                    this.set_viewport_content(document.createElement('page-user').set_user(APP_CONFIG.display_user()));
                } else {
                    if (screen.availHeight > screen.availWidth)
                        await SIDE_BAR.show_mobile();
                    if (APP_CONFIG.connected_user())
                        await SIDE_BAR.expand_my_repositories(true);
                    else
                        await SIDE_BAR.expand_recent(true);
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
        const repository = await Repository.find(item.repository);
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

    set_viewport_content(page_content) {
        if (this._viewport_content) {
            this._viewport_content.remove();
            delete this._viewport_content;
        }
        this._viewport_content = page_content;
        this._elements.viewport.append(this._viewport_content);
        return page_content;
    }
}

customElements.define("fileshare-app", FileshareApp);


export {APP}