import {ContextMenu, MenuAction} from "../context_menu";
import {create_repository} from "../../tools/create_repository/create_repository";

export {context_menu_my_repositories}

function context_menu_my_repositories() {
    const ctx = new ContextMenu();
    ctx.add_action(new MenuAction("Nouveau Dépôt", "/public/images/icons/icons8-storage-96.png", async () => {
        await create_repository();
    }, false));
}
