import {ContextMenu, MenuAction} from "../context_menu";
import {create_repository} from "../../../modals/create_repository/create_repository";

export {context_menu_my_repositories}

function context_menu_my_repositories(app) {
    const ctx = new ContextMenu();
    const user = app.state.connected_user();
    if (user && (user.user_role.toString() === 'Vip' || user.user_role.toString() === 'Admin'))
        ctx.add_action(new MenuAction("Nouveau Dépôt", "/public/images/icons/icons8-storage-96.png", async () => {
            await create_repository(app);
        }, false));
}
