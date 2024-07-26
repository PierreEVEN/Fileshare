import {humanFileSize} from "../../../../../common/tools/utils";

class CarouselOverlay {
    /**
     * @param carousel {Carousel}
     * @param container {HTMLElement}
     * @param item
     */
    constructor(carousel, container, item) {
        this.carousel = carousel;
        this.container = container;

        this.carousel_overlay = require('./carousel_overlay.hbs')({
            item: item,
            file_size: humanFileSize(item.size)
        }, {
            close_carousel: () => {
                carousel.close();
            }

        });
        container.append(this.carousel_overlay)
    }

}

export {CarouselOverlay}