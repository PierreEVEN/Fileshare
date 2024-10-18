import {ViewportContent} from "../../../../types/viewport_content/viewport_content";
import {
    DirectoryContentProvider,
    RepositoryRootProvider,
    TrashContentProvider
} from "../../../../types/viewport_content/providers";
import {ItemView} from "./content/item_view";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";
import {Uploader} from "./upload/uploader";
import {DropBox} from "./upload/drop_box";
import {MemoryTracker} from "../../../../types/memory_handler";
import {context_menu_item} from "../../context_menu/contexts/context_item";
import {APP} from "../../../../app";
import {ViewportToolbar} from "./toolbar/toolbar";
import {Carousel} from "./carousel/carousel";
import {Repository} from "../../../../types/repository";
import {CarouselList} from "./carousel/list/carousel_list";
import {humanFileSize, is_touch_screen} from "../../../../utilities/utils";
import {Selector} from "./selector";
import {MODAL} from "../../modal/modal";
import {CLIPBOARD, copy_items} from "../../tools/copy_items/copy_items";
import {delete_item} from "../../tools/delete_item/delete_item";

require('./repository_viewport.scss')

/**
 * @type {RepositoryViewport}
 */
let CURRENT_VIEWPORT = null;
document.addEventListener('keydown', async function (event) {
    if (!CURRENT_VIEWPORT)
        return;
    if (event.target.type === 'text')
        return;
    if (MODAL.is_open()) {
        if ((event.key === 'Backspace' || event.key === 'Escape'))
            MODAL.close();
        return;
    }
    if ((event.key === 'Backspace' || event.key === 'Escape')) {
        if (CURRENT_VIEWPORT.carousel) {
            await CURRENT_VIEWPORT.close_carousel();
        } else {
            if (event.key === 'Escape' && CURRENT_VIEWPORT.selector.get_selected_items().length > 1)
                CURRENT_VIEWPORT.selector.clear_selection();
            else {
                if (CURRENT_VIEWPORT.content.get_content_provider() instanceof DirectoryContentProvider) {
                    let item = CURRENT_VIEWPORT.content.get_content_provider().directory;
                    if (item.parent_item)
                        await APP.set_display_item(await item.filesystem().fetch_item(item.parent_item));
                    else
                        await APP.set_display_repository(await Repository.find(item.repository));
                    CURRENT_VIEWPORT.selector.select_item(item.id, false, false);
                }
            }
        }
    }
    if (event.key === 'ArrowRight') {
        if (CURRENT_VIEWPORT.carousel) {
            await CURRENT_VIEWPORT.carousel.list.select_next();
            return;
        } else if (MODAL.is_open())
            return;
        await CURRENT_VIEWPORT.selector.select_next(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'ArrowLeft') {
        if (CURRENT_VIEWPORT.carousel) {
            await CURRENT_VIEWPORT.carousel.list.select_previous();
            return;
        } else if (MODAL.is_open())
            return;
        await CURRENT_VIEWPORT.selector.select_previous(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'ArrowUp') {
        if (MODAL.is_open() || CURRENT_VIEWPORT.carousel)
            return;
        const item_per_row = CURRENT_VIEWPORT.container.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            await CURRENT_VIEWPORT.selector.select_previous(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'ArrowDown') {
        if (MODAL.is_open() || CURRENT_VIEWPORT.carousel)
            return;
        const item_per_row = CURRENT_VIEWPORT.container.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            await CURRENT_VIEWPORT.selector.select_next(event.ctrlKey, event.shiftKey);
    }
    if (event.key === 'Enter') {
        if (MODAL.is_open())
            return;

        if (CURRENT_VIEWPORT.selector.get_last_selected_item()) {
            let data = await CURRENT_VIEWPORT.try_get_item_data(CURRENT_VIEWPORT.selector.get_last_selected_item());
            if (!data || data.in_trash) return;
            if (data.is_regular_file) {
                await CURRENT_VIEWPORT.open_carousel(data)
            } else
                await CURRENT_VIEWPORT.open_item(data);
        }
    }
    if (!MODAL.is_open() && !CURRENT_VIEWPORT.carousel) {
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
                await copy_items(CLIPBOARD.consume(), CLIPBOARD.move_mode(), directory.repository, directory.id);
            } else if (CURRENT_VIEWPORT.content.get_content_provider() instanceof RepositoryRootProvider) {
                let repository = CURRENT_VIEWPORT.content.get_content_provider().repository;
                await copy_items(CLIPBOARD.consume(), CLIPBOARD.move_mode(), repository.id, null);
            }
        }
        if (event.key === 'Delete') {
            let items = [];
            for (const it of CURRENT_VIEWPORT.selector.get_selected_items())
                items.push(await CURRENT_VIEWPORT.try_get_item_data(it));
            if (CURRENT_VIEWPORT.content.get_content_provider() instanceof TrashContentProvider || event.shiftKey)
                await delete_item(items, false);
            else
                await delete_item(items, true);
        }
    }
}, false);

class RepositoryViewport extends MemoryTracker {
    /**
     * @param repository {Repository}
     * @param container {HTMLElement}
     */
    constructor(repository, container) {
        super(RepositoryViewport);
        const div = require('./repository_viewport.hbs')({}, {
            background_context: (event) => {
                event.preventDefault();
                if (!event.target.classList.contains('file-list'))
                    return;
                if (this.content.get_content_provider() instanceof DirectoryContentProvider)
                    context_menu_item(this.content.get_content_provider().directory)
                else
                    context_menu_repository(repository);
            },
            open_upload: () => {
                this.open_upload_container()
                div.elements.upload_button.style.display = 'none';
            },
            ctx_selection: async () => {
                const items = [];
                for (const item_id of this.selector.get_selected_items()) {
                    items.push(await this.content.get_filesystem().fetch_item(item_id));
                }
                context_menu_item(items);
            },
            unselect_all: () => {
                this.selector.clear_selection();
            }
        });

        CURRENT_VIEWPORT = this;

        /**
         * @type {Repository}
         */
        this.repository = repository;
        this._elements = div.elements;

        this.content = new ViewportContent();
        /**
         * @type {Map<number, ItemView>}
         * @private
         */
        this._visible_items = new Map();

        let content_num_items = 0;
        let content_total_size = 0;

        this.content.events.add('add', async (item) => {

            let in_trash = this.content.get_content_provider() instanceof TrashContentProvider;

            if (!this._visible_items.has(item.id) && item.in_trash === in_trash) {
                content_total_size += item.content_size;
                content_num_items += item.num_items;
                this._elements.footer_text.innerText = `${content_num_items} fichiers - ${humanFileSize(content_total_size)}`
            }

            this._visible_items.set(item.id, new ItemView(item, this._elements.content, {
                open: async () => {
                    await APP.set_display_item(item);
                },
                select: async (local_edit, fill_space) => {
                    if (is_touch_screen()) {
                        if (this.mobile_selection) {
                            this.selector.action_select(item.id, true, false);
                        } else {
                            await APP.set_display_item(item);
                        }
                    } else {
                        this.selector.action_select(item.id, local_edit, fill_space);
                    }
                },
                context_menu: async () => {
                    if (is_touch_screen()) {
                        if (!this.mobile_selection || !this.selector.is_selected(item.id)) {
                            this.selector.clear_selection();
                            this.mobile_selection = true;
                            this.selector.action_select(item.id, false, false);
                        } else {
                            const items = [];
                            for (const item_id of this.selector.get_selected_items()) {
                                items.push(await item.filesystem()?.fetch_item(item_id));
                            }
                            context_menu_item(items);
                        }
                        this.update_selection();
                    } else {
                        if (this.selector.is_selected(item.id)) {
                            const items = [];
                            for (const item_id of this.selector.get_selected_items()) {
                                items.push(await item.filesystem()?.fetch_item(item_id));
                            }
                            context_menu_item(items);
                        } else {
                            this.selector.select_item(item.id, false, false);
                            context_menu_item(item);
                        }
                    }
                }
            }))
        });

        this.toolbar = new ViewportToolbar(div.elements.toolbar, this.repository);

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

        container.append(div);

        /**
         * @type {HTMLElement}
         */
        this.container = container;

        this.drop_box = new DropBox(this._elements.drop_box, () => {
            if (!this.uploader)
                this.open_upload_container();
            return this.uploader;
        });

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
    }

    get_div(item_id) {
        return this._visible_items.get(item_id).div;
    }

    /**
     * @param item {FilesystemItem}
     * @return {Promise<void>}
     */
    async open_item(item) {
        this._elements.current_description.style.display = 'none';
        this._elements.current_description.innerText = '';
        if (!item.is_regular_file) {
            await this.close_carousel();
            await this.content.set_content_provider(new DirectoryContentProvider(item));
            if (item.description && item.description.plain().length !== 0) {
                import('../../../embed_viewers/custom_elements/document/showdown_loader.js').then(showdown_loader => {
                    this._elements.current_description.innerHTML = showdown_loader.convert_text(item.description.plain())
                })
                if (!this.uploader)
                    this._elements.current_description.style.display = 'flex';
            }
        } else {
            await this.open_carousel(item);
        }
        await this.toolbar.set_path_to(item, false);
    }

    async try_get_item_data(item_id) {
        let fs = null;
        if (this.content.get_content_provider().directory) {
            fs = this.content.get_content_provider().directory.filesystem();
        } else if (this.content.get_content_provider().repository) {
            fs = this.content.get_content_provider().repository.content;
        }

        if (fs) {
            return await fs.fetch_item(item_id)
        }
    }

    async open_root() {
        this._elements.current_description.style.display = 'none';
        this._elements.current_description.innerText = '';
        await this.close_carousel();
        if (this.content && (!this.content.get_content_provider() || !(this.content.get_content_provider() instanceof RepositoryRootProvider))) {
            await this.content.set_content_provider(new RepositoryRootProvider(this.repository));
            if (this.repository.description && this.repository.description.plain().length !== 0) {
                import('../../../embed_viewers/custom_elements/document/showdown_loader.js').then(showdown_loader => {
                    this._elements.current_description.innerHTML = showdown_loader.convert_text(this.repository.description.plain())
                })
                if (!this.uploader)
                    this._elements.current_description.style.display = 'flex';
            }
            await this.toolbar.set_path_to(null, false);
        }
    }

    async open_trash() {
        this._elements.current_description.style.display = 'none';
        this._elements.current_description.innerText = '';
        await this.close_carousel();
        if (this.content && (!this.content.get_content_provider() || !(this.content.get_content_provider() instanceof TrashContentProvider))) {
            await this.content.set_content_provider(new TrashContentProvider(this.repository));
            await this.toolbar.set_path_to(null, true);
        }
    }

    close_upload_container() {
        this._elements.upload_button.style.display = 'flex';
        this._elements.upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.delete();
        this.uploader = null;
        if (this._elements.current_description.innerText.length !== 0) {
            this._elements.current_description.style.display = 'flex';
        }
    }

    open_upload_container() {
        this._elements.upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.delete();
        this.uploader = new Uploader(this._elements.upload_container, this)
        this.uploader.expand(true);
        this._elements.current_description.style.display = 'none';
    }

    delete() {
        super.delete();
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

    async open_carousel(item) {
        await this.close_carousel();

        if (item.parent_item) {
            await this.content.set_content_provider(new DirectoryContentProvider(await item.filesystem().fetch_item(item.parent_item)));
        } else {
            await this.content.set_content_provider(new RepositoryRootProvider(await Repository.find(item.repository)));
        }

        const view_item = async (item, carousel_list) => {
            if (this.carousel)
                this.carousel.delete();
            this.carousel = null;
            this.selector.select_item(item.id, false, false);
            if (!this.selector.is_selected(item.id))
                this.selector.select_item(item.id, false, false);
            this.carousel = new Carousel(Carousel.get_fullscreen_container().background_container, item);
            this.carousel.on_close = async () => {
                await this.close_carousel();
            }
            this.carousel.list = carousel_list;
            await APP.state.open_item(item);
        }

        Carousel.get_fullscreen_container().root.style.display = 'flex';
        const container = Carousel.get_fullscreen_container();
        const item_list = new CarouselList(this, (item) => {
            view_item(item, item_list);
        });
        await view_item(item, item_list);
        await item_list.build_visual(container.list_container);
        item_list.select_item(item, true);
    }

    async close_carousel() {
        if (this.carousel) {
            this.carousel.delete();
            Carousel.get_fullscreen_container().background_container.innerHTML = '';
            Carousel.get_fullscreen_container().root.style.display = 'none';

            if (this.content.get_content_provider() instanceof DirectoryContentProvider)
                await APP.state.open_item(this.content.get_content_provider().directory);
            else if (this.content.get_content_provider() instanceof RepositoryRootProvider)
                await APP.state.open_repository(this.content.get_content_provider().repository);
        }
        this.carousel = null;
    }
}

export {RepositoryViewport}