import {ContextMenu, MenuAction} from "../context_menu";
import {create_directory} from "../../tools/create_directory/create_directory";
import {APP} from "../../../../app";
import {CLIPBOARD, copy_items} from "../../tools/copy_items/copy_items";

/**
 * @param repository {Repository}
 */
function context_menu_repository(repository) {
    const ctx = new ContextMenu();
    ctx.add_action(new MenuAction("Modifier", "/public/images/icons/icons8-edit-96.png", async () => {
        await APP.set_display_repository_settings(repository);
    }, false));
    ctx.add_action(new MenuAction("Nouveau Dossier", "/public/images/icons/icons8-add-folder-48.png", async () => {
        create_directory(repository.id);
    }, false))
    if (CLIPBOARD.has_items())
        ctx.add_action(new MenuAction("Coller ici", "/public/images/icons/icons8-paste-48.png", async () => {
            await copy_items(CLIPBOARD.consume(), CLIPBOARD.move_mode(), repository.id);
        }, false));
}

export {context_menu_repository}