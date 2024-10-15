import {ContextMenu, MenuAction} from "../context_menu";
import {create_directory} from "../../tools/create_directory/create_directory";
import {delete_item, restore_item} from "../../tools/delete_item/delete_item";
import {edit_item} from "../../tools/edit_item/edit_item";
import {FilesystemItem} from "../../../../types/filesystem_stream";

/**
 * @param item {FilesystemItem|FilesystemItem[]}
 */
function context_menu_item(item) {
    const ctx = new ContextMenu();

    let multi = item instanceof Array;

    if (!multi) {
        ctx.add_action(new MenuAction("Modifier", "/public/images/icons/icons8-edit-96.png", async () => {
            await edit_item(item);
        }, false));
        if (!item.is_regular_file) {
            ctx.add_action(new MenuAction("Nouveau Dossier", "/public/images/icons/icons8-add-folder-48.png", async () => {
                create_directory(item.repository, item.id);
            }, false))
        }
    }
    ctx.add_action(new MenuAction("Télécharger", "/public/images/icons/icons8-download-96.png", async () => {
        if (multi) {
            const ids = [];
            for (const it of item)
                ids.push(it.id);
            await FilesystemItem.downloads(ids);
        } else
            await item.download();
    }, false));
    const in_trash = (!multi && item.in_trash) || (multi && item.length !== 0 && item[0].in_trash);
    if (in_trash)
        ctx.add_action(new MenuAction("Restorer", "/public/images/icons/icons8-restore-96.png", async () => {
            await restore_item(item);
        }, false));
    ctx.add_action(new MenuAction("Supprimer", "/public/images/icons/icons8-trash-96.png", async () => {
        await delete_item(item, !in_trash);
    }, false));
}

export {context_menu_item}