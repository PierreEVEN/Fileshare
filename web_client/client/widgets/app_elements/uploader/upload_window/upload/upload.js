import {AppWidget} from "../../../../../src/app_widget";

require('./upload.scss')

class Upload extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_content(require('./upload.hbs'), {
            data: {is_regular_file: true}
        }, {})
    }
}

customElements.define('element-upload', Upload)