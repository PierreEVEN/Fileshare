import {CarouselItem} from "./carousel_item";

const carousel_fullscreen_hbs = require('./carousel_fullscreen.hbs');

let FULLSCREEN_CONTAINER = null;

class Carousel {
    /**
     * @param list {CarouselList}
     * @param container {HTMLElement}
     */
    constructor(list, container) {
        this.list = list;
        list.on_select_item = (item) => {
            new CarouselItem(container, item);
        }
        this.container = container;
    }

    static get_fullscreen_container() {
        if (!FULLSCREEN_CONTAINER) {
            const new_container = carousel_fullscreen_hbs({});
            document.body.append(new_container);
            FULLSCREEN_CONTAINER = {
                background_container: document.getElementById('carousel-fullscreen'),
                list_container: document.getElementById('carousel-fullscreen-list'),
            }
        }
        return FULLSCREEN_CONTAINER;
    }
}

export {Carousel}

