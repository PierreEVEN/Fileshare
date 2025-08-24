import {AppWidget} from "../../../../src/app_widget";

require('./controlbar.scss')

class ControlBar extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        /**
         * @type {DashPlayer}
         */
        this.player = this.closest('dash-player');
        this.set_content(require('./controlbar.hbs'));

    }

    disconnectedCallback() {

    }
}

customElements.define("streaming-controlbar", ControlBar);