let GLOBAL_CAROUSEL = null;

require('./global_carousel.scss')
require('./overlay/carousel_overlay')

class GlobalCarousel extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = '';
        this.viewport_container = document.createElement('div');
        this.viewport_container.classList.add('global-carousel-viewport');
        this.append(this.viewport_container);

        this.list_container = document.createElement('div');
        this.list_container.classList.add('global-carousel-list');
        this.append(this.list_container);
    }

    open(viewport, list) {
        this.style.display = 'flex';
        this.viewport_container.innerHTML = '';
        this.list_container.innerHTML = '';

        const overlay = document.createElement('carousel-overlay');
        list.events.add('select', (item) => {
            overlay.set_item(item)
        })

        this.viewport_container.append(overlay)

        this.viewport_container.append(viewport);
        this.list_container.append(list);
    }

    is_open() {
        return this.style.display !== 'none';
    }

    close() {
        this.viewport_container.innerHTML = '';
        this.list_container.innerHTML = '';
        this.style.display = 'none';
    }
}

customElements.define("global-carousel", GlobalCarousel);

function get_global_carousel() {
    if (!GLOBAL_CAROUSEL) {
        GLOBAL_CAROUSEL = document.createElement('global-carousel');
        document.body.append(GLOBAL_CAROUSEL)
    }
    return GLOBAL_CAROUSEL;
}

export {get_global_carousel}