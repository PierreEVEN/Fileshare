import {Authentication} from "../tools/authentication/authentication";
import {APP_CONFIG} from "../../../types/app_config";

class ErrorPage extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_error(this._error)
        this.classList.add('error_page');
    }

    set_error(error) {
        this._error = error;
        if (!this.isConnected)
            return;
        if (!error)
            return;

        let code = error.code.split(" ");
        if (code.length > 0)
            code = code[0];

        let message = error.message.split(":");
        if (message.length > 0 && !isNaN(message[0])) {
            message = message.slice(1).join(":");
        } else message.join(":")

        this.innerHTML = `<h1>⚠️ Error ${code} ⚠️</h1><h2>${message}</h2>`

        if (error.code === '403 Forbidden' && !APP_CONFIG.connected_user()) {
            Authentication.login();
        }
        return this;
    }
}

customElements.define("page-error", ErrorPage);

export {ErrorPage}