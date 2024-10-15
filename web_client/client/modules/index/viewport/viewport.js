import {RepositoryViewport} from "./repository_viewport/repository_viewport";
import {UserViewport} from "./user_viewport/user_viewport";
import {RepositorySettings} from "./repository_settings/repository_settings";

class Viewport {
    /**
     * @param container {HTMLElement}
     */
    constructor(container) {
        /**
         * @type {HTMLElement}
         * @private
         */
        this._container = container;

        /**
         * @type {any}
         * @private
         */
        this._viewport_object = null;
    }

    /**
     * @param repository {Repository}
     * @return {Promise<RepositoryViewport>}
     */
    async set_displayed_repository(repository) {
        if (!this._viewport_object || !(this._viewport_object instanceof RepositoryViewport) || repository !== this._viewport_object.repository) {
            if (this._viewport_object)
                this.clear();
            this._viewport_object = new RepositoryViewport(repository, this._container);
        }
        return this._viewport_object;
    }

    /**
     * @param repository {Repository}
     * @return {Promise<RepositoryViewport>}
     */
    async set_displayed_repository_settings(repository) {
        if (!this._viewport_object || !(this._viewport_object instanceof RepositorySettings) || repository !== this._viewport_object.repository) {
            if (this._viewport_object)
                this.clear();
            this._viewport_object = new RepositorySettings(repository, this._container);
        }
        return this._viewport_object;
    }

    /**
     * @param user {User}
     * @return {Promise<RepositoryViewport>}
     */
    async set_display_user(user) {
        if (!this._viewport_object || !(this._viewport_object instanceof UserViewport) || this._viewport_object.user !== user) {
            if (this._viewport_object)
                this.clear();
            this._viewport_object = new UserViewport(user, this._container);
        }
        return this._viewport_object;
    }

    clear() {
        this._container.innerHTML = '';
        if (this._viewport_object)
            this._viewport_object.delete();
        this._viewport_object = null;
    }
}

export {Viewport}