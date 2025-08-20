import {humanFileSize} from "../../../../src/utilities/utils";
import {Message, NOTIFICATION} from "../../../misc/message_box/notification";
import {AppWidget} from "../../../../src/app_widget";
import {get_mime_icon_path} from "../../../../src/utilities/mime_utils";

class CarouselOverlay extends AppWidget {
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

        this.set_content(require('./carousel_overlay.hbs'), {
            item: item.display_data(),
            icon: get_mime_icon_path(item.mimetype.plain()),
            file_size: humanFileSize(item.size)
        }, {
            close_carousel: () => {
                const parent = this.closest('global-carousel')
                if (parent)
                    parent.list_container.firstChild.exit();
            },
            download: () => {
                item.download();
            },
            share: async () => {
                let url = `${this.get_app().origin()}/api/item/get/${item.id}`;
                await navigator.clipboard.writeText(url);
                NOTIFICATION.success(new Message(url).title("Lien copié dans le presse-papier"))
            }
        });
    }

    connectedCallback() {
        this.set_item(this._item);
    }
}

customElements.define("carousel-overlay", CarouselOverlay);