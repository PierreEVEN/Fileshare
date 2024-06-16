import * as handlebars from "handlebars";
import {select_next_element, select_previous_element} from "./repos_builder";
import {humanFileSize} from "../../../common/tools/utils";

function lerp(a, b, f)
{
    return a + f * (b - a);
}

class ItemTile {
    constructor(container) {
        /**
         * @type {Promise<HTMLElement>}
         */
        this.document_container = new Promise(resolve => {
            import('../../../embed_viewers').then(async _ => {
                /**
                 * @type {HTMLElement}
                 */
                this.tile = require('./carousel_tile.hbs')();
                container.append(this.tile)
                resolve(this.tile.getElementsByClassName('carousel-container')[0])
            });
        });
    }

    /**
     * @param item {FilesystemObject}
     */
    async set_item(item) {
        const container_element = await this.document_container;
        container_element.innerHTML = handlebars.compile('{{item_image item}}')({item: item});
    }
}

class ItemCarousel {
    /**
     * @param base_item {FilesystemObject}
     */
    constructor(base_item) {
        const ctx = {
            'close_item_plain': () =>{},
            'show_previous_item': () =>{},
            'show_next_item': () =>{},
        };
        this.carousel = require('./carousel.hbs')({
            item: base_item,
            file_size: humanFileSize(base_item.size)
        },ctx);
        this.carousel_container = this.carousel.getElementsByClassName('item-carousel')[0];
        this.primary_tile = new ItemTile(this.carousel_container);
        this.secondary_tile = new ItemTile(this.carousel_container);

        this.desired_offset_x = 0;
        this.desired_offset_y = 0;
        this.current_offset_x = 0;
        this.current_offset_y = 0;
        document.body.append(this.carousel);

        this.primary_tile.set_item(base_item)
            .then(() => {
                this.secondary_tile.set_item(base_item).then(() => {
                    this._move_window();
                })
            })

        this.move()
    }

    move() {
        setTimeout(() => {
            this.scroll_to((Math.round(Math.random() * 2 - 1) * 3), 0);
            this.move();
        }, Math.random() * 2000)
    }

    scroll_to(offset_x, offset_y, force = false) {
        this.desired_offset_x = offset_x;
        this.desired_offset_y = offset_y;
        if (force) {
            this.current_offset_x = offset_x;
            this.current_offset_y = offset_y;
        }
        if (!this.animated) {
            this._move_window();
        }
    }

    _move_window() {
        const delta = this.last_frame ? (performance.now() - this.last_frame) / 1000 : 1 / 60.0;
        this.current_offset_x = lerp(this.current_offset_x, this.desired_offset_x, Math.min(delta * 4, 1))
        this.current_offset_y = lerp(this.current_offset_y, this.desired_offset_y, Math.min(delta * 4, 1))

        const local_x_offset = this.current_offset_x
        const local_offset_clamped_x = (local_x_offset + (local_x_offset < 0 ? -Math.floor(local_x_offset / 2) * 2 : 0)) % 2.0;
        const primary_local_offset_x = local_offset_clamped_x > 1 ? local_offset_clamped_x - 2 : local_offset_clamped_x;
        const secondary_local_offset_x = local_offset_clamped_x > 0 ? local_offset_clamped_x - 1 : local_offset_clamped_x + 1;

        const absolute_offset_x = primary_local_offset_x * window.innerWidth;
        const secondary_absolute_offset_x = secondary_local_offset_x * window.innerWidth;
        const absolute_offset_y = this.current_offset_y * window.innerHeight;

        if (this.primary_tile.tile && this.primary_tile.tile.style)
            this.primary_tile.tile.style.translate = `${absolute_offset_x}px ${absolute_offset_y}px`;
        if (this.secondary_tile.tile && this.secondary_tile.tile.style)
            this.secondary_tile.tile.style.translate = `${secondary_absolute_offset_x}px ${absolute_offset_y}px`;

        if (this.desired_offset_x === this.current_offset_x && this.desired_offset_y === this.current_offset_y) {
            this.animated = false;
            this.last_frame = null;
            return;
        }
        this.animated = true;
        this.last_frame = performance.now();
        window.requestAnimationFrame(() => {this._move_window()});
    }
}

export {ItemCarousel}