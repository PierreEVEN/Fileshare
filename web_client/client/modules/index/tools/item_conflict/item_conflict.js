import {MODAL} from "../../modal/modal";
import {delete_item, restore_item} from "../delete_item/delete_item";

/**
 * @param item_name {string}
 * @param existing {FilesystemItem}
 * @return {Promise<object>}
 */
async function overwrite_or_restore(item_name, existing) {
    return new Promise((resolve) => {
        const widget = require('./item_conflict.hbs')({
            name: item_name,
            restore: existing.in_trash,
            overwrite: existing.is_regular_file
        }, {
            overwrite: async (e) => {
                await delete_item(existing, false);
                resolve({handled: true, canceled: false});
                MODAL.close();
            },
            restore: async (e) => {
                await restore_item(existing);
                resolve({handled: false, canceled: false});
                MODAL.close();
            },
            cancel: () => {
                MODAL.close();
            }
        });
        MODAL.open(widget, {
            custom_width: '500px', custom_height: '250px', on_close: () => {
                resolve({handled: false, canceled: true});
            }
        })
    })
}


export {overwrite_or_restore}