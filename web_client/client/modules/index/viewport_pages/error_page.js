import {Authentication} from "../tools/authentication/authentication";
import {AppWidget} from "../../../app_widget";

class ErrorPage extends AppWidget {
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
            return this;
        if (!error)
            return this;

        let code = error.code.split(" ");
        if (code.length > 0)
            code = code[0];

        let message = error.message.split(":");
        if (message.length > 0 && !isNaN(message[0])) {
            message = message.slice(1).join(":");
        } else message.join(":")

        this.innerHTML = `<h1>⚠️ Error ${code} ⚠️</h1><h2>${message}</h2>`

        if (error.code === '403 Forbidden' && !this.get_app().state.connected_user()) {
            Authentication.login(this.get_app());
        }
        return this;
    }
}

customElements.define("page-error", ErrorPage);

export {ErrorPage}