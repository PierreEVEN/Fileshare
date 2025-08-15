import {AppWidget} from "../../../src/app_widget";

require('./search_bar.scss')

class SearchBar extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_content(require('./search_bar.hbs'), {}, {});
    }

    disconnectedCallback() {

    }
}

customElements.define('search-bar', SearchBar);