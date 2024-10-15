import {GLOBAL_EVENTS} from "../../../../types/event_manager";
import {context_menu_item} from "../../context_menu/contexts/context_item";
import {context_menu_repository} from "../../context_menu/contexts/context_repository";
import {APP} from "../../../../app";

class RepositoryNode {
    /**
     * @param side_bar {SideBar}
     * @param repository {Repository}
     * @param container {HTMLElement}
     * @param id {number}
     */
    constructor(side_bar, repository, container, id) {
        this._repository = repository;
        this._id = id;
        this._expanded = false;
        this._container = container;
        this.side_bar = side_bar;
    }

    async init() {
        const data = await this._repository.content.fetch_item(this._id);
        const div = require('./repository_tree.hbs')(data.display_data(), {
            expand: async () => {
                if (this.side_bar.selected_div === div) {
                    await this.expand_node(!this._expanded);
                } else {
                    await APP.set_display_item(this.data);
                    this.side_bar.select_div(div);
                    await this.expand_node(true);
                }
            },
            context: (e) => {
                context_menu_item(data);
                e.preventDefault();
            }
        });
        this.data = data;
        this._div = div;
        this._elements = div.elements;
        this._container.append(div);
        return this;
    }

    /**
     * @param expanded {boolean}
     */
    async expand_node(expanded) {
        if (this._expanded === expanded)
            return;

        this._expanded = expanded;
        this._elements.content.innerHTML = '';
        if (expanded) {

            /**
             * @type {Map<number, RepositoryNode>}
             * @private
             */
            this._items = new Map();

            const add_item = async (item_id) => {
                if (!this._items.has(item_id))
                    this._items.set(item_id, await new RepositoryNode(this.side_bar, this._repository, this._elements.content, item_id).init());
            }
            if (!this._listener_add)
                this._listener_add = GLOBAL_EVENTS.add('add_item', async (item) => {
                    if (item.parent_item === this._id && !item.in_trash && !item.is_regular_file) {
                        await add_item(item.id);
                    }
                })
            if (!this._listener_remove)
                this._listener_remove = GLOBAL_EVENTS.add('remove_item', async (item) => {
                    const item_node = this._items.get(item.id);
                    if (item_node) {
                        item_node._div.remove();
                        this._items.delete(item.id);
                    }
                })

            const content = await this._repository.content.directory_content(this._id);
            let size = 0;
            for (const id of content) {
                const item = await this._repository.content.fetch_item(id);
                if (!item.is_regular_file && !item.in_trash) {
                    await add_item(id);
                    size++;
                }
            }
            if (size === 0) {
                this._elements.arrow.innerText = '';
            }

            this._elements.category.classList.add('expand');
        } else {
            if (this._listener_add)
                this._listener_add.remove();
            delete this._listener_add;
            if (this._listener_remove)
                this._listener_remove.remove();
            delete this._listener_remove;
            this._elements.category.classList.remove('expand');
        }
    }

    async expand_to_item(item) {
        if (item.id === this.data.id) {
            this.side_bar.select_div(this._div);
            return;
        }
        await this.expand_node(true);

        let test_item = item;
        while (test_item) {
            const node = this._items.get(test_item.id)
            if (node) {
                await node.expand_to_item(item);
                return
            }
            test_item = test_item.parent_item ? await item.filesystem().fetch_item(test_item.parent_item) : null;
        }
    }
}

class RepositoryTree {

    /**
     * @param side_bar {SideBar}
     * @param container {HTMLElement}
     * @param repository {Repository}
     */
    constructor(side_bar, container, repository) {
        this.repository = repository;
        this._expanded = false;

        const root_div = require('./repository_tree_root.hbs')(repository.display_data(), {
            expand: async () => {
                if (this.side_bar.selected_div === root_div) {
                    await this.expand_node(!this._expanded);
                } else {
                    await APP.set_display_repository(this.repository);
                    this.side_bar.select_div(root_div);
                    await this.expand_node(true);
                }
            },
            trash: async () => {
                await APP.set_display_trash(this.repository);
                this.side_bar.select_div(root_div.elements.trash);
            },
            context: (e) => {
                context_menu_repository(repository);
                e.preventDefault();
            }
        });
        this._elements = root_div.elements;
        this.root = root_div;
        this.side_bar = side_bar;
        container.append(root_div);
    }

    async expand_to_item(item, trash) {
        await this.expand_node(true);
        if (!item) {
            this.side_bar.select_div(trash ? this._elements.trash : this.root);
            return;
        }

        let test_item = item;
        while (test_item) {
            const node = this._items.get(test_item.id)
            if (node) {
                await node.expand_to_item(item);
                return
            }
            test_item = test_item.parent_item ? await item.filesystem().fetch_item(test_item.parent_item) : null;
        }
    }

    /**
     * @param expanded {boolean}
     */
    async expand_node(expanded) {
        if (this._expanded === expanded)
            return;
        this._expanded = expanded;
        this._elements.content.innerHTML = '';
        if (expanded) {
            /**
             * @type {Map<number, RepositoryNode>}
             * @private
             */
            this._items = new Map();

            const add_item = async (item_id) => {
                if (!this._items.has(item_id))
                    this._items.set(item_id, await new RepositoryNode(this.side_bar, this.repository, this._elements.content, item_id).init());
            }

            if (!this._listener_add) {
                this._listener_add = GLOBAL_EVENTS.add('add_item', async (item) => {
                    if (item.parent_item === undefined && item.repository === this.repository.id && !item.in_trash && !item.is_regular_file) {
                        await add_item(item.id);
                    }
                })
            }
            if (!this._listener_remove)
                this._listener_remove = GLOBAL_EVENTS.add('remove_item', async (item) => {
                    const item_node = this._items.get(item.id);
                    if (item_node) {
                        item_node._div.remove();
                        this._items.delete(item.id);
                    }
                })

            const content = await this.repository.content.root_content();
            for (const item_id of content) {
                const item = await this.repository.content.fetch_item(item_id);
                if (!item.is_regular_file && !item.in_trash)
                    await add_item(item.id);
            }

            this._elements.trash.style.display = 'flex';
            this._elements.category.classList.add('expand');
        } else {
            this._elements.trash.style.display = 'none';
            if (this._listener_add)
                this._listener_add.remove();
            delete this._listener_add;
            if (this._listener_remove)
                this._listener_remove.remove();
            delete this._listener_remove;
            this._elements.category.classList.remove('expand');
        }
    }
}

export {RepositoryTree}