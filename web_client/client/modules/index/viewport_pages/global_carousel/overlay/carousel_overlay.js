import {humanFileSize} from "../../../../../utilities/utils";
import {Message, NOTIFICATION} from "../../../tools/message_box/notification";
import {get_app} from "../../../../../app";

class CarouselOverlay extends HTMLElement {
    constructor() {
        super();
    }

    set_item(item) {
        this._item = item;
        if (!this.isConnected)
            return;
        this.innerHTML = '';
        if (!this._item)
            return;

        const content = require('./carousel_overlay.hbs')({
            item: item.display_data(),
            file_size: humanFileSize(item.size)
        }, {
            close_carousel: () => {
                const parent = this.closest('global-carousel')
                if (parent)
                    parent.close();
            },
            download: () => {
                item.download();
            },
            share: async () => {
                let url = `${get_app(this).app_config.origin()}/api/item/get/${item.id}`;
                await navigator.clipboard.writeText(url);
                NOTIFICATION.success(new Message(url).title("Lien copié dans le presse-papier"))
            }
        });
        for (const element of content)
            this.append(element);
    }

    connectedCallback() {
        this.set_item(this._item);
    }
}

customElements.define("carousel-overlay", CarouselOverlay);