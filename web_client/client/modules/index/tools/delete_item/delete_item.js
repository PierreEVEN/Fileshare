import {Message, NOTIFICATION} from "../message_box/notification";
import {ContentRequest} from "../../../../types/remote_filesystem/content_request";

/**
 * @param app {FileshareApp}
 * @param item {RemoteItem|RemoteItem[]}
 * @param move_to_trash {boolean}
 * @return {Promise<void>}
 */
async function delete_item(app, item, move_to_trash) {
    let ids = null;
    if (item instanceof Array) {
        if (item.length === 0)
            return;
        ids = [];
        for (const it of item) {
            ids.push(it.id);
        }
    } else {
        ids = [item.id];
    }

    if (!move_to_trash) {
        if (!await new Promise((resolve, reject) => {
            app.get_modal().open(require('./ask_delete_item.hbs')({}, {
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
            app.get_modal().close();
            return;
        }
        app.get_modal().close();
    }


    const items = await app.fetch_api(`item/${move_to_trash ? 'move-to-trash' : 'delete'}`, 'POST',
        ids
    ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de supprimer le(s) fichier(s)")));
    if (move_to_trash)
        for (const item_id of items) {
            let item_object = await app.pool.fetch_item(item_id);
            item_object.in_trash = true;
            await set_item_to_trash(item_object, true);
            await item_object.refresh();
        }
    else {
        for (const item_id of items) {
            let item_object = await app.pool.fetch_item(item_id);
            await item_object.remove();
        }
    }
}

/**
 * @param app {FileshareApp}
 * @param item {RemoteItem}
 * @return {Promise<void>}
 */
async function restore_item(app, item) {
    let ids = null;
    if (item instanceof Array) {
        if (item.length === 0)
            return;
        ids = [];
        for (const it of item) {
            ids.push(it.id);
        }
    } else {
        ids = [item.id];
    }
    const items = await app.fetch_api(`item/restore`, 'POST',
        ids
    ).catch(error => NOTIFICATION.fatal(new Message(error).title("Impossible de restorer le fichier")));
    for (const item_id of items) {
        let item_object = await app.pool.fetch_item(item_id);
        item_object.in_trash = true;
        await set_item_to_trash(item_object, false);
        await item_object.refresh();
    }
}

/**
 * @param item {RemoteItem}
 * @param in_trash
 */
async function set_item_to_trash(item, in_trash) {
    item.in_trash = in_trash;
    if (item._children)
        for (const child of item._children)
            await set_item_to_trash(item.get_pool().find_item(child), in_trash);

    await item.get_pool().fetch_content(new ContentRequest().trash_root([item.repository]))

    if (in_trash && (await item.get_pool().fetch_repository(item.repository)).trash.has(item.id)) {
        await item.refresh();
    }
}

export {delete_item, restore_item}