import {User} from "../types/user";
import {Repository} from "../types/repository";
import {FilesystemItem} from "../types/filesystem_stream";
import {APP_COOKIES} from "../modules/index/tools/cookies/cookies";

class State {
    /**
     * @param app {FileshareApp}
     */
    constructor(app) {
        this.app = app;
        addEventListener('popstate', async (event) => {
            if (event.state && event.state.app_action)
                await this._handle_state(event.state)
        })

        this._disable_state = false;
    }

    /**
     * @param repository {Repository}
     */
    async open_repository(repository) {
        if (this._disable_state)
            return;

        APP_COOKIES.push_last_repositories(repository.id);

        history.pushState({
            app_action: true,
            repository: repository.id,
        }, "", `${this.app.app_config.origin()}/${await this._get_user_name(repository.owner)}/${repository.url_name.encoded()}`);
    }

    /**
     * @param repository {Repository}
     */
    async open_repository_settings(repository) {
        if (this._disable_state)
            return;

        APP_COOKIES.push_last_repositories(repository.id);

        history.pushState({
            app_action: true,
            repository: repository.id,
            settings: true
        }, "", `${this.app.app_config.origin()}/${await this._get_user_name(repository.owner)}/${repository.url_name.encoded()}/settings`);
    }

    /**
     * @param item {FilesystemItem}
     * @return {Promise<void>}
     */
    async open_item(item) {
        if (this._disable_state)
            return;

        APP_COOKIES.push_last_repositories(item.repository);

        let repository = await Repository.find(this.app, item.repository);
        history.pushState({
            app_action: true,
            item: item.id,
            repository: item.repository
        }, "", `${this.app.app_config.origin()}/${await this._get_user_name(repository.owner)}/${repository.url_name.encoded()}/tree${item.absolute_path.encoded()}${item.is_regular_file ? "" : ""}`);
    }

    /**
     * @param repository {Repository}
     */
    async open_trash(repository) {
        if (this._disable_state)
            return;
        history.pushState({
            app_action: true,
            repository: repository.id,
            trash: true
        }, "", `${this.app.app_config.origin()}/${await this._get_user_name(repository.owner)}/${repository.url_name.encoded()}/trash`);
    }

    async open_user(user) {
        if (this._disable_state)
            return;
        history.pushState({
            app_action: true,
            user: user.id
        }, "", `${this.app.app_config.origin()}/${user.name.encoded()}`);
    }

    async open_stats() {
        if (this._disable_state)
            return;
        history.pushState({
            app_action: true,
        }, "", `${this.app.app_config.origin()}/statistics`);
    }

    async _handle_state(state) {
        this._disable_state = true;
        if (state.item && state.repository) {
            let repository = await Repository.find(this.app, state.repository);
            await this.app.set_display_item(await repository.content.fetch_item(state.item));
        } else if (state.repository) {
            let repository = await Repository.find(this.app, state.repository);
            if (state.trash)
                await this.app.set_display_trash(repository);
            else if (state.settings)
                await this.app.set_display_repository_settings(repository);
            else
                await this.app.set_display_repository(repository);
        } else if (state.user) {
            let user = await User.fetch(this.app, state.user);
            await this.app.set_display_user(user);
        }
        this._disable_state = false;
    }

    async _get_user_name(id) {
        return (await User.fetch(this.app, id)).name.encoded()
    }
}

export {State}