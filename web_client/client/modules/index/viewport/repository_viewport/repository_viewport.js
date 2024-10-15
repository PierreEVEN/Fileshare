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
import {humanFileSize} from "../../../../utilities/utils";
import {Selector} from "./selector";
import {MODAL} from "../../modal/modal";

require('./repository_viewport.scss')

/**
 * @type {RepositoryViewport}
 */
let CURRENT_VIEWPORT = null;
document.addEventListener('keydown', async (event) => {
    if (!CURRENT_VIEWPORT)
        return;
    if (event.target.type === 'text')
        return;
    if ((event.key === 'Backspace' || event.key === 'Escape')) {
        if (MODAL.is_open()) {
            if (event.key === 'Escape')
                MODAL.close();
            return;
        }
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
        CURRENT_VIEWPORT.selector.select_next(event.shiftKey, event.ctrlKey);
    }
    if (event.key === 'ArrowLeft') {
        if (CURRENT_VIEWPORT.carousel) {
            await CURRENT_VIEWPORT.carousel.list.select_previous();
            return;
        } else if (MODAL.is_open())
            return;
        CURRENT_VIEWPORT.selector.select_previous(event.shiftKey, event.ctrlKey);
    }
    if (event.key === 'ArrowUp') {
        if (MODAL.is_open() || (this.directory_content && this.directory_content.item_carousel))
            return;
        const item_per_row = CURRENT_VIEWPORT.container.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            CURRENT_VIEWPORT.selector.select_previous(event.shiftKey, event.ctrlKey);
    }
    if (event.key === 'ArrowDown') {
        if (MODAL.is_open() || (this.directory_content && this.directory_content.item_carousel))
            return;
        const item_per_row = CURRENT_VIEWPORT.container.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            CURRENT_VIEWPORT.selector.select_next(event.shiftKey, event.ctrlKey);
    }
    if (event.key === 'Enter') {
        if (MODAL.is_open())
            return;

        const current_data = this.filesystem.get_object_data(this.navigator.last_selected_item);
        if (current_data) {
            if (current_data.is_regular_file) {
                CURRENT_VIEWPORT.open_carousel()
            } else
                this.navigator.set_current_dir(current_data.id);
        }
    }
    if (!MODAL.is_open() && !CURRENT_VIEWPORT.carousel) {
        if ((event.key === 'a' || event.key === 'A') && event.ctrlKey) {
            for (const elem of CURRENT_VIEWPORT._visible_items.keys())
                CURRENT_VIEWPORT.selector.select_item(elem, true, false);
            event.preventDefault();
        }
        if ((event.key === 'x' || event.key === 'X') && event.ctrlKey) {
            this.cut_selection();
        }
        if ((event.key === 'v' || event.key === 'V') && event.ctrlKey) {
            this.navigator.move_clipboard_to_parent(this.navigator.get_current_directory())
        }
        if (event.key === 'Delete') {
            this.move_selection_to_trash();
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

        this.content.events.add('add', (item) => {

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
                    this.selector.action_select(item.id, local_edit, fill_space);
                },
                context_menu: async () => {
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
    }

    get_div(item_id) {
        return this._visible_items.get(item_id).div;
    }

    /**
     * @param item {FilesystemItem}
     * @return {Promise<void>}
     */
    async open_item(item) {
        if (!item.is_regular_file) {
            this.close_carousel();
            await this.content.set_content_provider(new DirectoryContentProvider(item));
        } else {
            await this.open_carousel(item);
        }
        await this.toolbar.set_path_to(item, false);
    }


    async open_root() {
        this.close_carousel();
        if (this.content && (!this.content.get_content_provider() || !(this.content.get_content_provider() instanceof RepositoryRootProvider))) {
            await this.content.set_content_provider(new RepositoryRootProvider(this.repository));
            await this.toolbar.set_path_to(null, false);
        }
    }

    async open_trash() {
        this.close_carousel();
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
    }

    open_upload_container() {
        this._elements.upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.delete();
        this.uploader = new Uploader(this._elements.upload_container, this)
        this.uploader.expand(true);
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
        this.close_carousel();

        if (item.parent_item) {
            await this.content.set_content_provider(new DirectoryContentProvider(await item.filesystem().fetch_item(item.parent_item)));
        } else {
            await this.content.set_content_provider(new RepositoryRootProvider(await Repository.find(item.repository)));
        }

        const view_item = async (item) => {
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
            await APP.state.open_item(item);
        }

        Carousel.get_fullscreen_container().root.style.display = 'flex';
        const container = Carousel.get_fullscreen_container();
        const item_list = new CarouselList(this, (item) => {
            view_item(item);
        });
        await view_item(item);
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