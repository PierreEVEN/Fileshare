import {CarouselViewport} from "./carousel_viewport";
import {CarouselOverlay} from "./carousel_overlay";

const carousel_fullscreen_hbs = require('./carousel_fullscreen.hbs');

let FULLSCREEN_CONTAINER = null;

class Carousel {
    /**
     * @param list {CarouselList}
     * @param container {HTMLElement}
     * @param base_item
     */
    constructor(list, container, base_item) {
        this.list = list;
        list.on_select_item = (item) => {

            import('../../../../embed_viewers').then(async _ => {
                new CarouselViewport(container, item);
                new CarouselOverlay(this, container, item)
            });
        }

        list.on_select_item(base_item);

        this.container = container;
    }

    static get_fullscreen_container() {
        if (!FULLSCREEN_CONTAINER) {
            const new_container = carousel_fullscreen_hbs({});
            document.body.append(new_container);
            FULLSCREEN_CONTAINER = {
                root: new_container,
                background_container: document.getElementById('carousel-fullscreen'),
                list_container: document.getElementById('carousel-fullscreen-list'),
            }
        }
        return FULLSCREEN_CONTAINER;
    }

    close() {
        if (this.on_close)
            this.on_close();
        this.container.innerHTML = null;
    }
}

export {Carousel}

