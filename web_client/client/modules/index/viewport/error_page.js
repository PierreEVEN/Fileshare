import {Authentication} from "../tools/authentication/authentication";
import {APP_CONFIG} from "../../../types/app_config";

class ErrorPage {
    /**
     * @param container {HTMLElement}
     * @param error {object}
     */
    constructor(container, error) {
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

        let code = error.code.split(" ");
        if (code.length > 0)
            code = code[0];

        let message = error.message.split(":");
        if (message.length > 0 && !isNaN(message[0])) {
            message = message.slice(1).join(":");
        } else message.join(":")

        container.innerHTML = `<div class="error_page"><h1>⚠️ Error ${code} ⚠️</h1><h2>${message}</h2></div>`

        if (error.code === '403 Forbidden' && !APP_CONFIG.connected_user()) {
            Authentication.login();
        }

    }

    clear() {
        this._container.innerHTML = '';
    }
}

export {ErrorPage}