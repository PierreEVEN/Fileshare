require('./search_bar_option.scss')
const {AppWidget} = require("../../../../src/app_widget");

class SearchBarOption extends AppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        this.set_data(this._data);

        this.onclick = () => {
            this.set_is_focus(true);
        }
    }

    set_data(data) {
        this._data = data;
        if (!this.isConnected)
            return this;

        this.set_content(require('./search_bar_option.hbs'), data, {
            validate: () => {
                const value = this.elements().text.value;
                if (value === '') {
                    this.set_is_focus(false);
                    this.remove();
                    return;
                }
                this.set_is_focus(false);
            }
        });

        this.set_is_focus(true);
        return this;
    }

    set_is_focus(focus) {
        if (focus) {
            this.elements().text.style.display = 'unset';
            this.elements().display.style.display = 'none';
            this.elements().text.focus();
            this.closest('search-bar').elements().text.style.display = 'none';
        } else {
            this.elements().display.innerText = this.elements().text.value;
            this.elements().text.style.display = 'none';
            this.elements().display.style.display = 'unset';
            this.closest('search-bar').elements().text.style.display = 'flex';
            this.closest('search-bar').elements().text.focus();
        }
    }

    set(filter) {
        this._data.set(filter, this.elements().text.value);
    }
}

customElements.define('search-bar-option', SearchBarOption);