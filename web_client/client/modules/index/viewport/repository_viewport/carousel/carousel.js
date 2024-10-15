import {CarouselViewport} from "./viewport/carousel_viewport";
import {CarouselOverlay} from "./overlay/carousel_overlay";
import {MemoryTracker} from "../../../../../types/memory_handler";

require('./carousel.scss')
require('./carousel_fullscreen.scss')

let FULLSCREEN_CONTAINER = null;

class Carousel extends MemoryTracker {
    /**
     * @param container {HTMLElement}
     * @param base_item
     */
    constructor(container, base_item) {
        super(Carousel);
        import('../../../../embed_viewers').then(async _ => {
            new CarouselViewport(container, base_item);
            new CarouselOverlay(this, container, base_item)
        });
        this.container = container;
    }

    static get_fullscreen_container() {
        if (!FULLSCREEN_CONTAINER) {
            const new_container = require('./carousel_fullscreen.hbs')({});
            document.body.append(new_container);
            FULLSCREEN_CONTAINER = {
                root: new_container,
                background_container: document.getElementById('carousel-fullscreen'),
                list_container: document.getElementById('carousel-fullscreen-list'),
            }
        }
        return FULLSCREEN_CONTAINER;
    }

    delete() {
        super.delete();
        this.container.innerHTML = null;
    }

    close() {
        if (this.on_close)
            this.on_close();
        this.delete();
    }
}

export {Carousel}

