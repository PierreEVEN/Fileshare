import {Message, NOTIFICATION} from "../message_box/notification";

class Clipboard {
    constructor() {
        /**
         * @type {Map<number, RemoteItem>}
         * @private
         */
        this._items = new Map();

        this._move_mode = false;
    }

    /**
     * @param item {RemoteItem}
     */
    push(item) {
        this._items.set(item.id, item);
    }

    set_move_mode(move_mode) {
        this._move_mode = move_mode
    }

    clear() {
        this._items.clear();
    }

    items() {
        return Array.from(this._items.values())
    }

    has_items() {
        return this._items.size !== 0;
    }

    move_mode() {
        return this._move_mode;
    }

    consume() {
        let items = this.items();
        this.clear();
        return items;
    }
}

let CLIPBOARD = new Clipboard();

/**
 * @param app {FileshareApp}
 * @param items {RemoteItem[]}
 * @param remove_sources {boolean}
 * @param destination_repository {number}
 * @param destination_directory {number|null}
 * @return {Promise<void>}
 */
async function copy_items(app, items, remove_sources, destination_repository, destination_directory = null) {

    const copied_items = [];

    for (const item of items) {
        if (destination_directory) {
            if (await app.pool.find_item(destination_directory).find_child(item.name.plain())) {
                NOTIFICATION.warn(new Message("Un fichier du même nom existe déjà").title(`Impossible de copier ${item.name.plain()} ici`));
                continue;
            }
        } else {
            if (await app.pool.find_repository(destination_repository).find_child(item.name.plain())) {
                NOTIFICATION.warn(new Message("Un fichier du même nom existe déjà").title(`Impossible de copier ${item.name.plain()} ici`));
                continue;
            }
        }
        copied_items.push(item);
    }


    /**
     * @type {Map<number, RemoteItem>}
     */
    let item_map = new Map();
    if (copied_items.length === 0)
        return;
    let ids = [];
    for (const it of copied_items) {
        ids.push(it.id);
        item_map.set(it.id, it);
    }
    /**
     * @type {RemoteItem[]}
     */
    const new_items = await app.fetch_api(`item/copy`, 'POST',
        {
            destination_repository: destination_repository,
            destination_directory: destination_directory,
            items: ids,
            remove_sources: remove_sources,
        }
    ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de copier le(s) fichier(s)")));

    for (const item of new_items) {
        if (remove_sources) {
            await app.pool.remove_item(item.id);
        }
        await app.pool._register_item(item);
    }
}


export {copy_items, CLIPBOARD}