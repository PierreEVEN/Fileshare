import {AppWidget} from "../../../../src/app_widget";

import './upload/upload'

require('./upload_window.scss')

class UploadWindow extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_content(require('./upload_window.hbs'), {}, {});
    }

    disconnectedCallback() {

    }
}

customElements.define('upload-window', UploadWindow);