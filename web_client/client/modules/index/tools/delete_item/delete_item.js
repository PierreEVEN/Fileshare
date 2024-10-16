import {fetch_api} from "../../../../utilities/request";
import {FilesystemItem} from "../../../../types/filesystem_stream";
import {Message, NOTIFICATION} from "../message_box/notification";
import {MODAL} from "../../modal/modal";

/**
 * @param item {FilesystemItem|FilesystemItem[]}
 * @param move_to_trash {boolean}
 * @return {Promise<void>}
 */
async function delete_item(item, move_to_trash) {
    let ids = null;
    let fs_map = new Map();
    if (item instanceof Array) {
        if (item.length === 0)
            return;
        ids = [];
        for (const it of item) {
            ids.push(it.id);
            fs_map.set(it.id, it.filesystem());
        }
    } else {
        ids = [item.id];
        fs_map.set(item.id, item.filesystem());
    }

    if (!move_to_trash) {
        if (!await new Promise((resolve, reject) => {
            MODAL.open(require('./ask_delete_item.hbs')({}, {
                delete: () => {
                    resolve(true)
                },
                cancel: () => {
                    resolve(false);
                }
            }), {
                custom_width: '500px', custom_height: '300px', on_close: () => {
                    resolve(false);
                }
            })
        })) {
            NOTIFICATION.warn(new Message("Opération annulée"));
            MODAL.close();
            return;
        }
        MODAL.close();
    }


    const items = await fetch_api(`item/${move_to_trash ? 'move-to-trash' : 'delete'}/`, 'POST',
        ids
    ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le(s) fichier(s)")));
    if (move_to_trash)
        for (const item_id of items) {
            let item_object = await fs_map.get(item_id).fetch_item(item_id);
            item_object.in_trash = true;
            await set_item_to_trash(item_object, true);
            await item_object.refresh();
        }
    else {
        for (const item_id of items) {
            let item_object = await fs_map.get(item_id).fetch_item(item_id);
            await item_object.remove();
        }
    }
}

/**
 * @param item {FilesystemItem}
 * @return {Promise<void>}
 */
async function restore_item(item) {
    let ids = null;
    let fs_map = new Map();
    if (item instanceof Array) {
        if (item.length === 0)
            return;
        ids = [];
        for (const it of item) {
            ids.push(it.id);
            fs_map.set(it.id, it.filesystem());
        }
    } else {
        ids = [item.id];
        fs_map.set(item.id, item.filesystem());
    }
    const items = await fetch_api(`item/restore/`, 'POST',
        ids
    ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de restorer le fichier")));
    for (const item_id of items) {
        let item_object = await fs_map.get(item_id).fetch_item(item_id);
        item_object.in_trash = true;
        await set_item_to_trash(item_object, false);
        await item_object.refresh();
    }
}

/**
 * @param item {FilesystemItem}
 * @param in_trash
 */
async function set_item_to_trash(item, in_trash) {
    item.in_trash = in_trash;
    if (item.children)
        for (const child of item.children)
            await set_item_to_trash(item.filesystem().find(child), in_trash);

    if (in_trash && (await item.filesystem().trash_content()).has(item.id)) {
        await item.refresh();
    }
}

export {delete_item, restore_item}