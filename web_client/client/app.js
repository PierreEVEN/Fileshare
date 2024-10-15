import './utilities/handlebars_helpers';
//@FIX : don't importing this cause a weird issue when rendering pdf...
require('./modules/embed_viewers/custom_elements/pdf_viewer/pdf-viewer.hbs');
require('./modules/embed_viewers/custom_elements/document/code');
require('./modules/embed_viewers/custom_elements/document/markdown');
require('./modules/embed_viewers/custom_elements/pdf_viewer/pdf-viewer');
require('./app.scss');

import {GlobalHeader} from "./modules/index/global_header/global_header";
import {SideBar} from "./modules/index/side_bar/side_bar";

import "./modules/index/viewport/repository_viewport/upload/uploader";
import {State} from "./utilities/state";
import {Repository} from "./types/repository";
import {Viewport} from "./modules/index/viewport/viewport";
import {APP_CONFIG} from "./types/app_config";
import {FilesystemItem} from "./types/filesystem_stream";

class FileshareApp {
    constructor() {
        /**
         * @type {HTMLElement}
         * @private
         */
        const layout = require('./app.hbs')({}, {
            close_mobile: () => {
                this._side_bar.show_mobile();
            }
        });
        document.body.append(layout);

        /**
         * @type {object}
         * @private
         */
        this._elements = layout['elements'];

        /**
         * @type {Viewport}
         * @private
         */
        this._viewport = null;

        /**
         * @type {SideBar}
         * @private
         */
        this._side_bar = new SideBar(this, this._elements.side_bar);

        /**
         * @type {GlobalHeader}
         * @private
         */
        this._global_header = new GlobalHeader(this._elements.global_header);

        this._side_bar.events.add('show_mobile', (show) => {
            if (show)
                layout.elements.mobile_bg.classList.add('selected')
            else
                layout.elements.mobile_bg.classList.remove('selected')
        })

        this.state = new State(this);

        (async () => {
            if (await APP_CONFIG.display_item()) {
                await this._side_bar.expand_to(APP_CONFIG.display_repository(), await APP_CONFIG.display_item(), false);
                await this.set_display_item(await APP_CONFIG.display_item());
            } else if (APP_CONFIG.display_repository()) {
                await this._side_bar.expand_to(APP_CONFIG.display_repository(), null, APP_CONFIG.in_trash());
                if (APP_CONFIG.in_trash())
                    await this.set_display_trash(APP_CONFIG.display_repository());
                else if (APP_CONFIG.repository_settings())
                    await this.set_display_repository_settings(APP_CONFIG.display_repository());
                else
                    await this.set_display_repository(APP_CONFIG.display_repository());
            } else if (APP_CONFIG.display_user()) {
                await this.set_display_user(APP_CONFIG.display_user());
            }
        })().catch(error => console.error(`initialization failed :`, error));
    }

    /**
     * @param repository {Repository}
     * @return {Promise<void>}
     */
    async set_display_repository(repository) {
        console.assert(repository, "invalid repository");
        const {Viewport} = require("./modules/index/viewport/viewport");
        if (!this._viewport)
            this._viewport = new Viewport(this._elements.viewport);
        await this.state.open_repository(repository);
        const viewport = await this._viewport.set_displayed_repository(repository);
        await viewport.open_root();
    }

    /**
     * @param repository {Repository}
     * @return {Promise<void>}
     */
    async set_display_repository_settings(repository) {
        console.assert(repository, "invalid repository");
        const {Viewport} = require("./modules/index/viewport/viewport");
        if (!this._viewport)
            this._viewport = new Viewport(this._elements.viewport);
        await this.state.open_repository_settings(repository);
        await this._viewport.set_displayed_repository_settings(repository);
    }

    /**
     * @param item {FilesystemItem}
     * @return {Promise<void>}
     */
    async set_display_item(item) {
        const repository = await Repository.find(item.repository);
        if (!this._viewport)
            this._viewport = new Viewport(this._elements.viewport);
        const viewport = await this._viewport.set_displayed_repository(repository);
        await viewport.open_item(item);
        await this.state.open_item(item);
    }

    /**
     * @param repository {Repository}
     * @return {Promise<void>}
     */
    async set_display_trash(repository) {
        if (!this._viewport)
            this._viewport = new Viewport(this._elements.viewport);
        const viewport = await this._viewport.set_displayed_repository(repository);
        await viewport.open_trash();
        await this.state.open_trash(repository);
    }

    /**
     * @param user {User}
     * @return {Promise<void>}
     */
    async set_display_user(user) {
        if (!this._viewport)
            this._viewport = new Viewport(this._elements.viewport);
        await this._viewport.set_display_user(user);
        await this.state.open_user(user);
    }
}

const APP = new FileshareApp();

export {APP}