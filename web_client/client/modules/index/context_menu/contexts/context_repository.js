import {ContextMenu, MenuAction} from "../context_menu";
import {create_directory} from "../../tools/create_directory/create_directory";
import {CLIPBOARD, copy_items} from "../../tools/copy_items/copy_items";
import {StateSelection} from "../../../../utilities/state_selection";

/**
 * @param app {FileshareApp}
 * @param repository {Repository}
 */
function context_menu_repository(app, repository) {
    const ctx = new ContextMenu();
    ctx.add_action(new MenuAction("Modifier", "/public/images/icons/icons8-edit-96.png", async () => {
        app.state.select(new StateSelection().set_repository(repository, false, true));
    }, false));
    ctx.add_action(new MenuAction("Nouveau Dossier", "/public/images/icons/icons8-add-folder-48.png", async () => {
        create_directory(app, repository.id, null);
    }, false))
    if (CLIPBOARD.has_items())
        ctx.add_action(new MenuAction("Coller ici", "/public/images/icons/icons8-paste-48.png", async () => {
            await copy_items(app, CLIPBOARD.consume(), CLIPBOARD.move_mode(), repository.id);
        }, false));
}

export {context_menu_repository}