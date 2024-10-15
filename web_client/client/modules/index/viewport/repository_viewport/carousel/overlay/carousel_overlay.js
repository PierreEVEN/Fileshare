import {humanFileSize} from "../../../../../../utilities/utils";
import {APP_CONFIG} from "../../../../../../types/app_config";
import {Message, NOTIFICATION} from "../../../../tools/message_box/notification";

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
            item: item.display_data(),
            file_size: humanFileSize(item.size)
        }, {
            close_carousel: () => {
                carousel.close();
            },
            download: () => {
                item.download();
            },
            share: async () => {
                let url = `${APP_CONFIG.origin()}/api/item/get/${item.id}/`;
                await navigator.clipboard.writeText(url);
                NOTIFICATION.success(new Message(url).title("Lien copié dans le presse-papier"))
            }
        });
        container.firstChild.before(this.carousel_overlay)
    }

}

export {CarouselOverlay}