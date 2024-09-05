import {humanFileSize, PAGE_CONTEXT} from "../../../../../common/tools/utils";
import {print_message} from "../../message_box";

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
            },
            download: () => {
                window.open(`${PAGE_CONTEXT.repos_path()}/file/${item.id}`, '_blank').focus();
            },
            share: async () => {
                let url = `${location.origin}${PAGE_CONTEXT.repos_path()}/file/${item.id}`;
                await navigator.clipboard.writeText(url);
                print_message('info', 'Lien copié dans le presse - papier', url)
            }
        });
        container.firstChild.before(this.carousel_overlay)
    }

}

export {CarouselOverlay}