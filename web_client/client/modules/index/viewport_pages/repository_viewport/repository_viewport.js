import {ContentProvider, ViewportContent} from "../../../../types/viewport_content/viewport_content";
import {
    DirectoryContentProvider, FilterContentProvider,
    RepositoryRootProvider,
    TrashContentProvider
} from "../../../../types/viewport_content/providers";
import "./item/item";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";
import "./upload/uploader";
import "./upload/drop_box";
import {context_menu_item} from "../../context_menu/contexts/context_item";
import "./toolbar/toolbar";
import {Repository} from "../../../../types/repository";
import "../../tools/carousel/list/carousel_list";
import "../../tools/carousel/viewport/carousel_viewport";
import {humanFileSize, is_touch_screen} from "../../../../utilities/utils";
import {Selector} from "./selector";
import {CLIPBOARD, copy_items} from "../../tools/copy_items/copy_items";
import {delete_item} from "../../tools/delete_item/delete_item";
import {AppWidget} from "../../../../app_widget";
import "../global_carousel/global_carousel"
import {StateSelection} from "../../../../utilities/state_selection";

require('./repository_viewport.scss')

/**
 * @type {RepositoryViewport}
 */
let CURRENT_VIEWPORT = null;
document.addEventListener('keydown', async function (event) {
    if (!CURRENT_VIEWPORT || !CURRENT_VIEWPORT.closest('fileshare-app'))
        return;
    if (event.target.type === 'text')
        return;
    if (CURRENT_VIEWPORT.get_app().get_modal().is_open()) {
        if (event.key === 'Escape')
            CURRENT_VIEWPORT.get_app().get_modal().close();
        return;
    }
    if ((event.key === 'Backspace' || event.key === 'Escape')) {
        if (CURRENT_VIEWPORT.carousel_list) {
            await CURRENT_VIEWPORT.close_carousel();
        } else {
            if (event.key === 'Escape' && CURRENT_VIEWPORT.selector.get_selected_items().length > 1)
                CURRENT_VIEWPORT.selector.clear_selection();
            else {
                if (CURRENT_VIEWPORT.content.get_content_provider() instanceof DirectoryContentProvider) {
                    let item = CURRENT_VIEWPORT.content.get_content_provider().directory;
                    if (item.parent_item)
                        await CURRENT_VIEWPORT.get_app().state.select(new StateSelection().set_item(await item.pool().fetch_item(item.parent_item)));
                    else
                        await CURRENT_VIEWPORT.get_app().state.select(new StateSelection().set_repository(await CURRENT_VIEWPORT.get_app().pool.fetch_repository(item.repository)));
                    CURRENT_VIEWPORT.selector.select_item(item.id, false, false);
                }
            }
        }
    }
    if (event.key === 'ArrowRight') {
        if (CURRENT_VIEWPORT.carousel_list) {
            await CURRENT_VIEWPORT.carousel_list._select_next();
            return;
        } else if (CURRENT_VIEWPORT.get_app().get_modal().is_open())
            return;
        await CURRENT_VIEWPORT.selector.select_next(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'ArrowLeft') {
        if (CURRENT_VIEWPORT.carousel_list) {
            await CURRENT_VIEWPORT.carousel_list._select_previous();
            return;
        } else if (CURRENT_VIEWPORT.get_app().get_modal().is_open())
            return;
        await CURRENT_VIEWPORT.selector.select_previous(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'ArrowUp') {
        if (CURRENT_VIEWPORT.get_app().get_modal().is_open() || CURRENT_VIEWPORT.carousel_list)
            return;
        const item_per_row = CURRENT_VIEWPORT.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            await CURRENT_VIEWPORT.selector.select_previous(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'ArrowDown') {
        if (CURRENT_VIEWPORT.get_app().get_modal().is_open() || CURRENT_VIEWPORT.carousel_list)
            return;
        const item_per_row = CURRENT_VIEWPORT.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            await CURRENT_VIEWPORT.selector.select_next(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'Enter') {
        if (CURRENT_VIEWPORT.get_app().get_modal().is_open())
            return;

        if (CURRENT_VIEWPORT.selector.get_last_selected_item()) {
            let data = await CURRENT_VIEWPORT.try_get_item_data(CURRENT_VIEWPORT.selector.get_last_selected_item());
            if (!data || data.in_trash) return;
            await CURRENT_VIEWPORT.get_app().state.select(new StateSelection().set_item(data));
        }
    }
    if (!CURRENT_VIEWPORT.get_app().get_modal().is_open() && !CURRENT_VIEWPORT.carousel_list) {
        if ((event.key === 'a' || event.key === 'A') && event.ctrlKey) {
            for (const elem of CURRENT_VIEWPORT._visible_items.keys())
                CURRENT_VIEWPORT.selector.select_item(elem, true, false);
            event.preventDefault();
        }
        if ((event.key === 'x' || event.key === 'X') && event.ctrlKey) {
            CLIPBOARD.clear();
            for (const item of CURRENT_VIEWPORT.selector.get_selected_items())
                CLIPBOARD.push(await CURRENT_VIEWPORT.try_get_item_data(item));
            CLIPBOARD.set_move_mode(true);
        }
        if ((event.key === 'c' || event.key === 'C') && event.ctrlKey) {
            CLIPBOARD.clear();
            for (const item of CURRENT_VIEWPORT.selector.get_selected_items())
                CLIPBOARD.push(await CURRENT_VIEWPORT.try_get_item_data(item));
            CLIPBOARD.set_move_mode(true);
        }
        if ((event.key === 'v' || event.key === 'V') && event.ctrlKey) {

            if (CURRENT_VIEWPORT.content.get_content_provider() instanceof DirectoryContentProvider) {
                let directory = CURRENT_VIEWPORT.content.get_content_provider().directory;
                await copy_items(CURRENT_VIEWPORT.get_app(), CLIPBOARD.consume(), CLIPBOARD.move_mode(), directory.repository, directory.id);
            } else if (CURRENT_VIEWPORT.content.get_content_provider() instanceof RepositoryRootProvider) {
                let repository = CURRENT_VIEWPORT.content.get_content_provider().repository;
                await copy_items(CURRENT_VIEWPORT.get_app(), CLIPBOARD.consume(), CLIPBOARD.move_mode(), repository.id, null);
            }
        }
        if (event.key === 'Delete') {
            let items = [];
            for (const it of CURRENT_VIEWPORT.selector.get_selected_items())
                items.push(await CURRENT_VIEWPORT.try_get_item_data(it));
            if (CURRENT_VIEWPORT.content.get_content_provider() instanceof TrashContentProvider || event.shiftKey)
                await delete_item(CURRENT_VIEWPORT.get_app(), items, false);
            else
                await delete_item(CURRENT_VIEWPORT.get_app(), items, true);
        }
    }
}, false);

class RepositoryViewport extends AppWidget {
    constructor() {
        super();
        CURRENT_VIEWPORT = this;

        /**
         * @type {Map<number, ItemView>}
         * @private
         */
        this._visible_items = new Map();
    }

    connectedCallback() {

        let content_num_items = 0;
        let content_total_size = 0;

        /**
         * @type {ViewportContent}
         */
        this.content = new ViewportContent(this);

        this.content.events.add('add', async (item) => {

            let in_trash = this.content.get_content_provider() instanceof TrashContentProvider;

            if (!this._visible_items.has(item.id) && item.in_trash === in_trash) {
                content_total_size += item.content_size;
                content_num_items += item.num_items;
                this._elements.footer_text.innerText = `${content_num_items} fichiers - ${humanFileSize(content_total_size)}`
            }

            const new_item = document.createElement('item-view');
            new_item.set_item(item);
            new_item.ondblclick = async () => {
                await this.get_app().state.select(new StateSelection().set_item(item));
            };
            new_item.onclick = async (event) => {
                const local_edit = event.ctrlKey;
                const fill_space = event.shiftKey;
                if (is_touch_screen()) {
                    if (this.mobile_selection) {
                        this.selector.action_select(item.id, true, false);
                    } else {
                        await this.get_app().state.select(new StateSelection().set_item(item));
                    }
                } else {
                    this.selector.action_select(item.id, local_edit, fill_space);
                }
            };
            new_item.oncontextmenu = async (e) => {
                e.preventDefault();
                if (is_touch_screen()) {
                    if (!this.mobile_selection || !this.selector.is_selected(item.id)) {
                        this.selector.clear_selection();
                        this.mobile_selection = true;
                        this.selector.action_select(item.id, false, false);
                    } else {
                        const items = [];
                        for (const item_id of this.selector.get_selected_items()) {
                            items.push(await item.get_pool().fetch_item(item_id));
                        }
                        context_menu_item(this.get_app(), items);
                    }
                    this.update_selection();
                } else {
                    if (this.selector.is_selected(item.id)) {
                        const items = [];
                        for (const item_id of this.selector.get_selected_items()) {
                            items.push(await item.pool().fetch_item(item_id));
                        }
                        context_menu_item(this.get_app(), items);
                    } else {
                        this.selector.select_item(item.id, false, false);
                        context_menu_item(this.get_app(), item);
                    }
                }
            }

            this._elements.content.append(new_item);
            this._visible_items.set(item.id, new_item);
        });

        this.content.events.add('remove', (item) => {
            const div = this._visible_items.get(item.id);
            if (div) {
                div.remove();
                this._visible_items.delete(item.id);

                content_total_size -= item.content_size;
                content_num_items -= item.num_items;
                this._elements.footer_text.innerText = `${content_num_items} fichiers - ${humanFileSize(content_total_size)}`
            }
        })

        /**
         * @type {Selector}
         */
        this.selector = new Selector(this);
        this.selector.events.add('update_selection', () => {
            if (this.mobile_selection && this.selector.get_selected_items().length > 0) {
                this._elements.num_elements.innerText = `${this.selector.get_selected_items().length} éléments`;
                this._elements.mobile_selection.classList.add('visible');
            } else {
                this.mobile_selection = false;
                this._elements.mobile_selection.classList.remove('visible');
            }
        })



        this.innerHTML = '';

        const div = require('./repository_viewport.hbs')({}, {
            background_context: (event) => {
                event.preventDefault();
                if (!event.target.classList.contains('file-list'))
                    return;
                if (this.content.get_content_provider() instanceof DirectoryContentProvider)
                    context_menu_item(this.get_app(), this.content.get_content_provider().directory)
                else
                    context_menu_repository(this.get_app(), this.repository);
            },
            open_upload: () => {
                this.open_upload_container()
                div.hb_elements.upload_button.style.display = 'none';
            },
            ctx_selection: async () => {
                const items = [];
                for (const item_id of this.selector.get_selected_items()) {
                    items.push(await this.content.get_filesystem().fetch_item(item_id));
                }
                context_menu_item(this.get_app(), items);
            },
            unselect_all: () => {
                this.selector.clear_selection();
            },
        });
        for (const item of div)
            this.append(item);

        this._elements = div.hb_elements;
        this._elements.drop_box.get_uploader = () => {
            if (!this.uploader)
                this.open_upload_container();
            return this.uploader;
        }

        if (!this._on_state_select_cb)
            this._on_state_select_cb = this.get_app().state.events.add('select', async selection => {
                await this._on_state_select(selection)
            })

        this.get_app().state.events.add('user_connected', (user) => {
            this.set_upload_button_visible(!!user.new)
        })
        this.set_upload_button_visible(!!this.get_app().state.connected_user())
    }

    set_upload_button_visible(visible) {
        if (visible) {
            if (!this.uploader)
                this._elements.upload_button.style.display = 'flex';
        }
        else {
            this.close_upload_container();
                this._elements.upload_button.style.display = 'none';
        }
    }

    /**
     * @param selection {StateSelection}
     * @returns {Promise<void>}
     * @private
     */
    async _on_state_select(selection) {
        const tmp_provider = await this._spawn_content_provider(selection);
        if (!this.content.get_content_provider() || !this.content.get_content_provider().is_same(tmp_provider)) {
            await this.content.set_content_provider(tmp_provider);
        } else {
            tmp_provider.delete();
        }

        if (selection.item) {
            const repository = await this.get_app().pool.fetch_repository(selection.item.repository);
            if (!this.repository || this.repository.id !== repository.id)
                this._set_repository(repository);

            const directory = selection.item.is_regular_file ? selection.item.parent_item ? await repository.get_pool().fetch_item(selection.item.parent_item) : selection.item : selection.item;

            if (selection.item.is_regular_file) {
                await this._open_carousel(selection.item);
            }
            else {
                await this.close_carousel();
                await this._update_description(directory);
            }
            await this._elements.toolbar.set_toolbar_path(selection.in_trash ? null : directory, selection.in_trash);
        } else if (selection.repository) {
            await this._update_description(selection.repository);
            this._set_repository(selection.repository);
            await this._elements.toolbar.set_toolbar_path(null, selection.in_trash);
            await this.close_carousel();
        }
    }

    /**
     * @param selection {StateSelection}
     * @private
     * @return Promise<ContentProvider>
     */
    async _spawn_content_provider(selection) {
        if (selection.item) {
            const repository = await this.get_app().pool.fetch_repository(selection.item.repository);
            if (selection.in_trash) {
                return new TrashContentProvider(repository);
            } else {
                const directory = selection.item.is_regular_file ? selection.item.parent_item ? await repository.get_pool().fetch_item(selection.item.parent_item) : null : selection.item;
                if (directory)
                    return new DirectoryContentProvider(directory);
                else
                    return new RepositoryRootProvider(repository);
            }
        } else if (selection.repository) {
           if (selection.in_trash)
                return new TrashContentProvider(selection.repository);
            else
                return new RepositoryRootProvider(selection.repository);
        }
    }

    /**
     * @param object {RemoteItem | Repository}
     * @returns {Promise<void>}
     * @private
     */
    async _update_description(object) {
        this._elements.current_description.style.display = 'none';
        this._elements.current_description.innerText = '';

        if (object && object.description && object.description.plain().length !== 0 && object.description.plain() !== 'undefined') {
            import('../../../embed_viewers/custom_elements/document/showdown_loader.js').then(showdown_loader => {
                this._elements.current_description.innerHTML = showdown_loader.convert_text(object.description.plain())
            })
            if (!this.uploader)
                this._elements.current_description.style.display = 'flex';
        }
    }

    _set_repository(repository) {
        this.repository = repository;
        this._elements.toolbar.set_repository(this.repository)
    }

    get_div(item_id) {
        return this._visible_items.get(item_id);
    }

    async try_get_item_data(item_id) {
        return await this.get_app().pool.fetch_item(item_id)
    }

    close_upload_container() {
        this._elements.upload_button.style.display = 'flex';
        this._elements.upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.remove();
        this.uploader = null;
        if (this._elements.current_description.innerText.length !== 0) {
            this._elements.current_description.style.display = 'flex';
        }
    }

    open_upload_container() {
        this._elements.upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.remove();

        this.uploader = document.createElement('upload-widget').set_viewport(this);
        this._elements.upload_container.append(this.uploader);

        this.uploader.expand(true);
        this._elements.current_description.style.display = 'none';
    }

    async set_search_filter(filter) {
        if (!filter) {
            if (this.content.get_content_provider()) {
                if (this.content.get_content_provider().directory) {
                    await this.content.set_content_provider(new DirectoryContentProvider(this.content.get_content_provider().directory));
                } else if (this.content.get_content_provider().repository) {
                    await this.content.set_content_provider(new RepositoryRootProvider(this.content.get_content_provider().repository));
                }
            }
        } else {
            const previous = this.content.get_content_provider();
            await this.content.set_content_provider(new ContentProvider());
            await this.content.set_content_provider(new FilterContentProvider(this.repository, previous ? previous.directory : null, filter))
        }
    }

    disconnectedCallback() {
        if (this._on_state_select_cb)
            this._on_state_select_cb.remove();
        delete this._on_state_select_cb;
        if (this.uploader)
            this.uploader.delete();
        this.uploader = null;
        if (this.content)
            this.content.delete();
        this.content = null;
        if (this.drop_box)
            this.drop_box.delete();
        this.drop_box = null;
        if (this.selector)
            this.selector.delete();
        this.selector = null;
        if (CURRENT_VIEWPORT === this)
            CURRENT_VIEWPORT = null;

        this.close_carousel();
    }

    async _open_carousel(item) {
        // Spawn carousel if needed
        if (!this.get_app().get_carousel().is_open() || !this._carousel_viewport || !this._carousel_viewport.isConnected || !this.carousel_list || !this.carousel_list.isConnected) {
            /**
             * @type {CarouselViewport}
             * @private
             */
            this._carousel_viewport = document.createElement('carousel-viewport');
            /**
             * @type {CarouselList}
             */
            this.carousel_list = document.createElement('carousel-list');
            this.get_app().get_carousel().open(this._carousel_viewport, this.carousel_list);

            this.carousel_list.events.add('select', (item) => {
                this.get_app().state.select(new StateSelection().set_item(item));
            })
        }
        this._carousel_viewport.set_item(item);
        if (this._carousel_content_provider !== this.content.get_content_provider()) {
            this._carousel_content_provider = this.content.get_content_provider();
            await this.carousel_list.set_items(this.content.get_displayed_items());
            this.carousel_list.select_item(item, true, true);
        } else {
            this.carousel_list.select_item(item, false, true);
        }
    }

    async close_carousel() {
        if (!this.isConnected)
            return;
        if (this.get_app().get_carousel().is_open()) {
            this.carousel_list = null;
            this._carousel_viewport = null;
            this._carousel_content_provider = null;
            this.get_app().get_carousel().close();

            if (this.content.get_content_provider() instanceof DirectoryContentProvider)
                await this.get_app().state.select(new StateSelection().set_item(this.content.get_content_provider().directory));
            else if (this.content.get_content_provider() instanceof RepositoryRootProvider)
                await this.get_app().state.select(new StateSelection().set_repository(this.content.get_content_provider().repository));
        }
    }
}

customElements.define("page-repository", RepositoryViewport);
