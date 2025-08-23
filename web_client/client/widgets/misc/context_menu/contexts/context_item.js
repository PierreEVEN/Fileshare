import {ContextMenu, MenuAction} from "../context_menu";
import {create_directory} from "../../../modals/create_directory/create_directory";
import {delete_item, restore_item} from "../../../modals/delete_item/delete_item";
import {edit_item} from "../../../modals/edit_item/edit_item";
import {CLIPBOARD, copy_items} from "../../../modals/copy_items/copy_items";
import {RemoteItem} from "../../../../src/remote_filesystem/remote_item";
import {Permission} from "../../../../src/utilities/permissions";
import {ContentRequest} from "../../../../src/remote_filesystem/content_request";

/**
 * @param app {FileshareApp}
 * @param item {RemoteItem|RemoteItem[]}
 */
async function context_menu_item(app, item) {
    const ctx = new ContextMenu();

    let min_permission = Permission.full();

    let multi = item instanceof Array;
    if (multi && item.length === 1) {
        multi = false;
        item = item[0];
    }
    if (multi) {
        const items = [];
        for (const it of item)
            items.push(it.id)
        await app.pool.fetch_content(new ContentRequest().item_permissions(items));
        for (const it of item) {
            const perm = await it.permissions();
            if (perm.level() < min_permission.level())
                min_permission = perm;
        }
    } else {
        min_permission = await item.permissions();
    }

    if (!multi && min_permission.allow(Permission.full())) {
        ctx.add_action(new MenuAction("Modifier", "/public/images/icons/icons8-edit-96.png", async () => {
            await edit_item(app, item);
        }, false));
        if (!item.is_regular_file) {
            ctx.add_action(new MenuAction("Nouveau Dossier", "/public/images/icons/icons8-add-folder-48.png", async () => {
                create_directory(app, item.repository, item.id);
            }, false))
        }
    }
    ctx.add_action(new MenuAction("Télécharger", "/public/images/icons/icons8-download-96.png", async () => {
        if (multi) {
            const ids = [];
            for (const it of item)
                ids.push(it.id);
            await RemoteItem.downloads(ids);
        } else
            await item.download();
    }, false));

    ctx.add_action(new MenuAction("Copier", "/public/images/icons/icons8-copy-48.png", async () => {
        CLIPBOARD.clear();
        if (multi) {
            for (const it of item)
                CLIPBOARD.push(it);
        } else
            CLIPBOARD.push(item);
        CLIPBOARD.set_move_mode(false);
    }, false));

    if (min_permission.allow(Permission.full()))
        ctx.add_action(new MenuAction("Couper", "/public/images/icons/icons8-cut-48.png", async () => {
            CLIPBOARD.clear();
            if (multi) {
                for (const it of item)
                    CLIPBOARD.push(it);
            } else
                CLIPBOARD.push(item);
            CLIPBOARD.set_move_mode(true);
        }, false));

    if (!multi && !item.is_regular_file && CLIPBOARD.has_items() && min_permission.allow(Permission.add_content()))
        ctx.add_action(new MenuAction("Coller ici", "/public/images/icons/icons8-paste-48.png", async () => {
            await copy_items(app, CLIPBOARD.consume(), CLIPBOARD.move_mode(), item.repository, item.id);
        }, false));

    const in_trash = (!multi && item.in_trash) || (multi && item.length !== 0 && item[0].in_trash);
    if (in_trash && min_permission.allow(Permission.full()))
        ctx.add_action(new MenuAction("Restorer", "/public/images/icons/icons8-restore-96.png", async () => {
            await restore_item(app, item);
        }, false));
    if (min_permission.allow(Permission.full()))
        ctx.add_action(new MenuAction("Supprimer", "/public/images/icons/icons8-trash-96.png", async () => {
            await delete_item(app, item, !in_trash);
        }, false));
}

export {context_menu_item}