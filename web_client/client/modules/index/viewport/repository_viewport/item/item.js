require('./item.scss')

class ItemView extends HTMLElement {
    constructor() {
        super();
    }

    set_item(item) {
        this.innerHTML = '';
        this.append(require('./item.hbs')({item: item.display_data()}));
    }
}

customElements.define("item-view", ItemView);