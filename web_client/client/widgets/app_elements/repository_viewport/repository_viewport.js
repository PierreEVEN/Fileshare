import {
    DirectoryContentProvider,
    RepositoryRootProvider,
    TrashContentProvider
} from "../../../src/utilities/providers";
import "../item/item";
import {context_menu_repository} from "../../misc/context_menu/contexts/context_repository";
import "../upload/uploader";
import "../upload/drop_box";
import {context_menu_item} from "../../misc/context_menu/contexts/context_item";
import "../toolbar/toolbar";
import {Repository} from "../../../src/remote_filesystem/repository";
import "../carousel/list/carousel_list";
import "../carousel/viewport/carousel_viewport";
import {AppWidget} from "../../../src/app_widget";
import "../global_carousel/global_carousel"
import {StateSelection} from "../../../src/state/state_selection";
import "../content_page/content_page"

require('./repository_viewport.scss')

class RepositoryViewport extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = '';

        this.set_content(require('./repository_viewport.hbs'), {}, {
            open_upload: () => {
                this.open_upload_container()
                this.elements().upload_button.style.display = 'none';
            },
            ctx_selection: async () => {
                const items = [];
                for (const item_id of this.selector.get_selected_items()) {
                    items.push(await this.content.get_filesystem().fetch_item(item_id));
                }
                context_menu_item(this.get_app(), items);
            },
            unselect_all: async () => {
                await this.selector.clear_selection();
            },
        });

        this.oncontextmenu = (event) => {
            event.preventDefault();
            if (!event.target.classList.contains('repository-content') && !event.target.classList.contains('app-navigable-item'))
                return;
            if (this.elements().content._provider instanceof DirectoryContentProvider)
                context_menu_item(this.get_app(), this.elements().content._provider.directory)
            else
                context_menu_repository(this.get_app(), this.repository);
        },

            this.elements().drop_box.get_uploader = () => {
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

        this.close_carousel();
    }

    set_upload_button_visible(visible) {
        if (visible) {
            if (!this.uploader)
                this.elements().upload_button.style.display = 'flex';
        } else {
            this.close_upload_container();
            this.elements().upload_button.style.display = 'none';
        }
    }

    /**
     * @param selection {StateSelection}
     * @returns {Promise<void>}
     * @private
     */
    async _on_state_select(selection) {
        this.elements().content.set_content_provider(await this._spawn_content_provider(selection));
        this.elements().content.focus();

        if (selection.item) {
            const repository = await this.get_app().pool.fetch_repository(selection.item.repository);
            if (!this.repository || this.repository.id !== repository.id)
                this._set_repository(repository);
            const directory = selection.item.is_regular_file ? selection.item.parent_item ? await repository.get_pool().fetch_item(selection.item.parent_item, true) : selection.item : selection.item;

            if (selection.item.is_regular_file) {
                await this._open_carousel(selection.item);
            } else {
                await this.close_carousel();
                await this._update_description(directory);
            }
            await this.elements().toolbar.set_toolbar_path(selection.in_trash ? null : directory, selection.in_trash);
        } else if (selection.repository) {
            await this._update_description(selection.repository);
            this._set_repository(selection.repository);
            await this.elements().toolbar.set_toolbar_path(null, selection.in_trash);
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
                const directory = selection.item.is_regular_file ? selection.item.parent_item ? await repository.get_pool().fetch_item(selection.item.parent_item, true) : null : selection.item;
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
        this.elements().current_description.style.display = 'none';
        this.elements().current_description.innerText = '';

        if (object && object.description && object.description.plain().length !== 0 && object.description.plain() !== 'undefined') {
            import('../../preview/document/markdown/showdown_loader.js').then(showdown_loader => {
                this.elements().current_description.innerHTML = showdown_loader.convert_text(object.description.plain())
            })
            if (!this.uploader)
                this.elements().current_description.style.display = 'flex';
        }
    }

    _set_repository(repository) {
        this.repository = repository;
        this.elements().toolbar.set_repository(this.repository)
    }

    close_upload_container() {
        this.elements().upload_button.style.display = 'flex';
        this.elements().upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.remove();
        this.uploader = null;
        if (this.elements().current_description.innerText.length !== 0) {
            this.elements().current_description.style.display = 'flex';
        }
    }

    open_upload_container() {
        this.elements().upload_container.innerHTML = '';
        if (this.uploader)
            this.uploader.remove();

        this.uploader = document.createElement('upload-widget').set_viewport(this);
        this.elements().upload_container.append(this.uploader);

        this.uploader.expand(true);
        this.elements().current_description.style.display = 'none';
    }

    async _open_carousel(item) {
        if (!this.get_app().get_carousel().is_open()) {
            this.get_app().get_carousel().open();
            this._cb_carousel_select_event = this.get_app().get_carousel().list().events.add('select', (item) => {
                this.elements().content.selector.select_item(item.id, false, false);
            });
            this._cb_carousel_close_event = this.get_app().get_carousel().events.add('close', async () => {
                if (this.elements().content._provider instanceof DirectoryContentProvider)
                    await this.get_app().state.select(new StateSelection().set_item(this.elements().content._provider.directory));
                else if (this.elements().content._provider instanceof RepositoryRootProvider)
                    await this.get_app().state.select(new StateSelection().set_repository(this.elements().content._provider.repository));
            });
        }

        await this.get_app().get_carousel().list().set_items(await this.elements().content._provider.get_content());
        await this.get_app().get_carousel().set_item(item);
        await this.get_app().get_carousel().focus();
    }

    async close_carousel() {
        if (!this.isConnected)
            return;
        if (this.get_app().get_carousel().is_open()) {
            await this.get_app().get_carousel().close();
            if (this._cb_carousel_select_event)
                this._cb_carousel_select_event.remove();
            delete this._cb_carousel_select_event;
            if (this._cb_carousel_close_event)
                this._cb_carousel_close_event.remove();
            delete this._cb_carousel_close_event;
        }
    }
}

customElements.define("page-repository", RepositoryViewport);
