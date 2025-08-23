import {ContextMenu, MenuAction} from "../context_menu";
import {create_directory} from "../../../modals/create_directory/create_directory";
import {CLIPBOARD, copy_items} from "../../../modals/copy_items/copy_items";
import {StateSelection} from "../../../../src/state/state_selection";
import {Permission} from "../../../../src/utilities/permissions";

/**
 * @param app {FileshareApp}
 * @param repository {Repository}
 */
async function context_menu_repository(app, repository) {
    let permissions = await repository.permissions();
    const ctx = new ContextMenu();
    if (permissions.allow(Permission.full()))
        ctx.add_action(new MenuAction("Modifier", "/public/images/icons/icons8-edit-96.png", async () => {
            app.state.select(new StateSelection().set_repository(repository, false, true));
        }, false));
    if (permissions.allow(Permission.full()))
        ctx.add_action(new MenuAction("Nouveau Dossier", "/public/images/icons/icons8-add-folder-48.png", async () => {
            create_directory(app, repository.id, null);
        }, false))
    if (CLIPBOARD.has_items() && permissions.allow(Permission.add_content()))
        ctx.add_action(new MenuAction("Coller ici", "/public/images/icons/icons8-paste-48.png", async () => {
            await copy_items(app, CLIPBOARD.consume(), CLIPBOARD.move_mode(), repository.id);
        }, false));
}

export {context_menu_repository}