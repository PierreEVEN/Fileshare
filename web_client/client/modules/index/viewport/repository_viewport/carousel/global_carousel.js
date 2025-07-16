let GLOBAL_CAROUSEL = null;

class GlobalCarousel extends HTMLElement {
    constructor() {
        super();
        this.classList.add('global-carousel-body')

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
        this.viewport_container.append(viewport);
        this.list_container.append(list);
    }

    close() {
        this.viewport_container.innerHTML = '';
        this.list_container.innerHTML = '';
        this.style.display = 'none';
    }
}

function get_global_carousel() {
    if (!GLOBAL_CAROUSEL) {
        GLOBAL_CAROUSEL = new GlobalCarousel();
        document.body.append(GLOBAL_CAROUSEL)
    }
    return GLOBAL_CAROUSEL;
}

export {get_global_carousel}