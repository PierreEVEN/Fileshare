import {CarouselItem} from "./carousel_item";

class Carousel {
    /**
     * @param list {CarouselList}
     * @param container {HTMLElement}
     */
    constructor(list, container) {
        this.list = list;

        this.container = container;
        this.current_item = new CarouselItem();
    }
}

export {Carousel}

