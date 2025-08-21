require('./global_carousel.scss')
require('./overlay/carousel_overlay')
const {NavigableAppWidget} = require("../../../src/utilities/navigable");
const {EventManager} = require("../../../src/event_manager");

class GlobalCarousel extends NavigableAppWidget {
    constructor() {
        super();

        this.events = new EventManager();
    }

    connectedCallback() {
        super.connectedCallback();
        this.set_content(require('./global_carousel.hbs'), {}, {});
        this._cb_select_item = this.list().events.add('select', (item) => {
            this.viewport().set_item(item);
            this.overlay().set_item(item);
        });
        this._cb_close = this.overlay().events.add('close', async () => {
            await this.close();
        });
    }

    disconnectedCallback() {
        if (this._cb_select_item)
            this._cb_select_item.remove();
        delete this._cb_select_item;
        if (this._cb_close)
            this._cb_close.remove();
        delete this._cb_close;
    }

    open() {
        this.style.display = 'flex';
    }

    async close() {
        if (this.is_open()) {
            this.viewport().set_item(null);
            this.overlay().set_item(null);
            this.style.display = 'none';
            await this.events.broadcast('close')
        }
    }

    /**
     * @param item {RemoteItem}
     */
    async set_item(item) {
        this.viewport().set_item(item);
        this.overlay().set_item(item);
        await this.list().select_item(item);
    }

    /**
     * @returns {CarouselList}
     */
    list() {
        return this.elements().list;
    }

    /**
     * @returns {CarouselOverlay}
     */
    overlay() {
        return this.elements().overlay;
    }

    /**
     * @returns {CarouselViewport}
     */
    viewport() {
        return this.elements().viewport;
    }

    is_open() {
        return this.style.display === 'flex';
    }

    async move_next(e) {
        e.preventDefault();
        await this.list()._select_next();
    }

    async move_previous(e) {
        e.preventDefault();
        await this.list()._select_previous();
    }

    async exit() {
        await this.close();
    }
}

customElements.define("global-carousel", GlobalCarousel);