import {delete_item, restore_item} from "../delete_item/delete_item";
import {get_app} from "../../../../app";

/**
 * @param item_name {string}
 * @param existing {FilesystemItem}
 * @param context {HTMLElement}
 * @return {Promise<object>}
 */
async function overwrite_or_restore(item_name, existing, context) {
    return new Promise((resolve) => {
        const widget = require('./item_conflict.hbs')({
            name: item_name,
            restore: existing.in_trash,
            overwrite: existing.is_regular_file
        }, {
            overwrite: async (e) => {
                await delete_item(existing, false, widget);
                resolve({handled: true, canceled: false});
                get_app(context).get_modal().close();
            },
            restore: async (e) => {
                await restore_item(existing, context);
                resolve({handled: false, canceled: false});
                get_app(context).get_modal().close();
            },
            cancel: () => {
                get_app(context).get_modal().close();
            }
        });
        get_app(context).get_modal().open(widget, {
            custom_width: '500px', custom_height: '250px', on_close: () => {
                resolve({handled: false, canceled: true});
            }
        })
    })
}


export {overwrite_or_restore}