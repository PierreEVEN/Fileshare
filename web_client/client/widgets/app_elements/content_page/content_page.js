import {EventManager} from "../../../src/event_manager";
import {Selector} from "./selector";
import {is_touch_screen} from "../../../src/utilities/utils";
import {StateSelection} from "../../../src/state/state_selection";
import {context_menu_item} from "../../misc/context_menu/contexts/context_item";
import {NavigableAppWidget} from "../../../src/utilities/navigable";
import {CLIPBOARD, copy_items} from "../../modals/copy_items/copy_items";
import {DirectoryContentProvider, RepositoryRootProvider, TrashContentProvider} from "../../../src/utilities/providers";
import {delete_item} from "../../modals/delete_item/delete_item";
import {context_menu_repository} from "../../misc/context_menu/contexts/context_repository";
import {edit_item} from "../../modals/edit_item/edit_item";

require('./content_page.scss')

class ContentPage extends NavigableAppWidget {
    constructor() {
        super();

        this.events = new EventManager();
        /**
         * @type {Map<number, ItemView>}
         * @private
         */
        this._items = new Map();

        this._page = 0;
        this._elements_per_page = 100;
    }

    /**
     * @param provider {ContentProvider}
     */
    async set_content_provider(provider) {
        if (!this.isConnected) {
            this._futur_provider = provider;
            return this;
        }

        if (provider && this._provider && this._provider.is_same(provider)) {
            provider.delete();
            return this;
        }

        if (this._provider)
            this._provider.delete();

        /**
         * @type {ContentProvider}
         * @private
         */
        this._provider = provider;

        this._clear();

        if (this._cb_provider_add)
            this._cb_provider_add.remove();
        if (!this._provider)
            return this;

        /**
         * @type {Selector}
         */
        this.selector = new Selector(this.container().children);

        await this._refresh_page();

        this._cb_provider_add = this._provider.events.add('add', item => {
            this._add_item(item);
        })

        return this;
    }

    async _refresh_page() {
        this._clear();

        const content = await this._provider.get_content();
        const page_count = Math.ceil(content.length / this._elements_per_page);
        this._page = Math.max(0, Math.min(page_count - 1, this._page));

        for (let i = this._page * this._elements_per_page; i < content.length && i < (this._page + 1) * this._elements_per_page; ++i)
            this._add_item(content[i]);

        if (page_count <= 1) {
            this.elements().page_select.style.display = 'none';
            return;
        } else {
            this.elements().page_select.style.display = 'flex';
        }

        const list = this.elements().page_list;
        list.innerHTML = '';
        const cell_num = window.innerWidth < 600 ? 3 : 7;

        let start = Math.max(0, Math.min(this._page - Math.floor(cell_num / 2), page_count - cell_num));
        if (start > 0) {
            const button = document.createElement('button');
            button.innerText = '1';
            button.onclick = async () => {
                this._page = 0;
                await this._refresh_page();
            }
            list.append(button);
            const spacer = document.createElement('span');
            spacer.innerText = '...'
            list.append(spacer)
        }

        for (let i = 0; i < cell_num; ++i) {
            if (start + i >= page_count)
                return;
            const button = document.createElement('button');
            button.innerText = (start + i + 1).toString();

            button.onclick = async () => {
                this._page = start + i;
                await this._refresh_page();
            }

            if ((start + i) === this._page)
                button.classList.add('select')
            list.append(button);
        }
        if (start + cell_num < page_count) {
            const spacer = document.createElement('span');
            spacer.innerText = '...'
            list.append(spacer)
            const button = document.createElement('button');
            button.innerText = page_count.toString();
            button.onclick = async () => {
                this._page = page_count - 1;
                await this._refresh_page();
            }
            list.append(button);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        this._remove_item_cb = this.get_app().pool.events.add('remove_item', item => {
            this._remove_item(item);
        })

        this.set_content(require('./content_page.hbs'), {}, {
            page_next: async () => {
                this._page++;
                await this._refresh_page();
            },
            page_previous: async () => {
                this._page--;
                await this._refresh_page();
            }
        })

        this.oncontextmenu = (e) => {
            e.preventDefault();
            if (e.target.classList.contains('container') || e.target === this) {
                if (this._provider instanceof DirectoryContentProvider)
                    context_menu_item(this.get_app(), this._provider.directory);
                else if (this._provider instanceof RepositoryRootProvider)
                    context_menu_repository(this.get_app(), this._provider.repository);
            }
        }

        this.set_content_provider(this._futur_provider);
    }

    /**
     * @returns {HTMLElement}
     */
    container() {
        return this.elements().container;
    }

    disconnectedCallback() {
        if (this._remove_item_cb)
            this._remove_item_cb.remove();
        delete this._remove_item_cb;
        if (this._cb_provider_add)
            this._cb_provider_add.remove();
        delete this._cb_provider_add;
        if (this._provider)
            this._provider.delete();
        delete this._provider;
    }

    move_next(e) {
        e.preventDefault();
        this.selector.select_next(e.shiftKey || e.ctrlKey)
    }

    move_previous(e) {
        e.preventDefault();
        this.selector.select_previous(e.shiftKey || e.ctrlKey)
    }

    async move_up(e) {
        e.preventDefault();
        const item_per_row = this.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            await this.selector.select_previous(e.ctrlKey || e.shiftKey);
    }

    async move_down(e) {
        e.preventDefault();
        const item_per_row = this.offsetWidth / 120;
        for (let i = 1; i < item_per_row; ++i)
            await this.selector.select_next(e.ctrlKey || e.shiftKey);
    }

    enter(e) {
        const selected = this.selector.get_last_selected_item();
        if (selected)
            this.get_app().state.select(new StateSelection().set_item(this.get_app().pool.find_item(selected)));
    }

    async exit(e) {
        const this_item = this._provider['directory'];
        if (this_item) {
            if (this_item.parent_item) {
                const parent = await this.get_app().pool.fetch_item(this_item.parent_item);
                if (parent)
                    await this.get_app().state.select(new StateSelection().set_item(parent));
            } else {
                const this_repository = await this.get_app().pool.fetch_repository(this_item.repository);
                if (this_repository)
                    await this.get_app().state.select(new StateSelection().set_repository(this_repository));
            }
        }
    }

    async any_key(e) {
        if (e.key === 'a' && e.ctrlKey)
            for (const child of this.container().children)
                await this.selector.select_item(child.item().id, true, false);
        else if (e.key === 'c' && e.ctrlKey) {
            CLIPBOARD.clear();
            for (const item of this.selector.get_selected_items())
                CLIPBOARD.push(await this.get_app().pool.find_item(item));
            CLIPBOARD.set_move_mode(false);
        } else if (e.key === 'x' && e.ctrlKey) {
            CLIPBOARD.clear();
            for (const item of this.selector.get_selected_items())
                CLIPBOARD.push(await this.get_app().pool.find_item(item));
            CLIPBOARD.set_move_mode(true);
        } else if (e.key === 'v' && e.ctrlKey) {
            if (this._provider instanceof DirectoryContentProvider) {
                let directory = this._provider.directory;
                await copy_items(this.get_app(), CLIPBOARD.consume(), CLIPBOARD.move_mode(), directory.repository, directory.id);
            } else if (this._provider instanceof RepositoryRootProvider) {
                let repository = this._provider.repository;
                await copy_items(this.get_app(), CLIPBOARD.consume(), CLIPBOARD.move_mode(), repository.id, null);
            }
        } else if (e.key === 'Delete') {
            let items = [];
            for (const it of this.selector.get_selected_items())
                items.push(await this.get_app().pool.find_item(it));
            if (this._provider instanceof TrashContentProvider || e.shiftKey)
                await delete_item(this.get_app(), items, false);
            else
                await delete_item(this.get_app(), items, true);
        } else if (e.key === 'F2') {
            const item = this.selector.get_last_selected_item();
            if (item)
                await edit_item(this.get_app(), this.get_app().pool.find_item(item));
        }
    }

    /**
     * @param a {ItemView}
     * @param b {ItemView}
     * @return number
     * @private
     */
    _compare_sort(a, b) {
        const item_a = a.item();
        const item_b = b.item();
        if (item_a.is_regular_file && !item_b.is_regular_file)
            return -1;
        if (item_b.is_regular_file && !item_a.is_regular_file)
            return 1;
        return -item_a.name.plain().localeCompare(item_b.name.plain());
    }

    _add_item(item) {
        if (this._items.has(item.id))
            return;

        const div = document.createElement('item-view').set_item(item);

        div.context_menu = async () => {
            if (is_touch_screen()) {
                if (!this.mobile_selection || !this.selector.is_selected(item.id)) {
                    await this.selector.clear_selection();
                    this.mobile_selection = true;
                    await this.selector.action_select(item.id, false, false);
                } else {
                    const items = [];
                    for (const item_id of this.selector.get_selected_items()) {
                        items.push(await item.get_pool().fetch_item(item_id));
                    }
                    context_menu_item(this.get_app(), items);
                }
            } else {
                if (this.selector.is_selected(item.id)) {
                    const items = [];
                    for (const item_id of this.selector.get_selected_items()) {
                        items.push(await item.get_pool().fetch_item(item_id));
                    }
                    context_menu_item(this.get_app(), items);
                } else {
                    await this.selector.select_item(item.id, false, false);
                    context_menu_item(this.get_app(), item);
                }
            }
        }

        div.select = async (ctrl, shift) => {
            if (is_touch_screen()) {
                if (this.mobile_selection) {
                    await this.selector.action_select(item.id, true, false);
                } else {
                    await this.get_app().state.select(new StateSelection().set_item(item));
                }
            } else {
                await this.selector.action_select(item.id, ctrl, shift);
            }
        }

        this._items.set(item.id, div);
        let existing_children = Array.from(this.container().children);
        let insertIndex = existing_children.findIndex(child => this._compare_sort(child, div) < 0);
        if (insertIndex === -1)
            this.container().appendChild(div);
        else
            this.container().insertBefore(div, this.container().children[insertIndex]);
    }

    _remove_item(item) {
        if (item === this._provider.directory) {
            if (item.parent_item)
                this.get_app().state.select(new StateSelection().set_item(this.get_app().pool.find_item(item.parent_item)))
            else
                this.get_app().state.select(new StateSelection().set_repository(this.get_app().pool.find_repository(item.repository)))
            return;
        }
        const div = this._items.get(item.id);
        if (div)
            div.remove();
        this._items.delete(item.id);
    }

    _clear() {
        this._items.clear();
        this.container().innerHTML = '';
    }
}

customElements.define('content-page', ContentPage);