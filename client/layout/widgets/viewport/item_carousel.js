import * as handlebars from "handlebars";
import {select_next_element, select_previous_element} from "./repos_builder";
import {humanFileSize} from "../../../common/tools/utils";

function lerp(a, b, f) {
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
     * @return {Promise<void>}
     */
    async load() {
        await this.document_container;
    }

    /**
     * @param item {FilesystemObject}
     */
    async set_item(item) {
        if (this.item_id === item.id)
            return;
        this.item_id = item.id;
        const container_element = await this.document_container;
        if (!item) {
            container_element.innerHTML = ''
            return;
        }
        container_element.innerHTML = handlebars.compile('{{item_image item}}')({item: item});
    }
}

class ItemCarousel {
    /**
     * @param directory_content {DirectoryContent}
     */
    constructor(directory_content) {
        const ctx = {
            'close_item_plain': () => {
                directory_content.close_carousel();
            },
            'show_previous_item': () => {
                directory_content.navigator.select_item(directory_content.get_item_before(directory_content.navigator.last_selected_item, true), false, false);
            },
            'show_next_item': () => {
                directory_content.navigator.select_item(directory_content.get_item_after(directory_content.navigator.last_selected_item, true), false, false);
            },
        };
        const item = directory_content.navigator.filesystem.get_object_data(directory_content.navigator.last_selected_item);

        this.directory_content = directory_content;

        directory_content.navigator.bind_on_select_item(new_item => {
            const new_index = directory_content.get_item_index(new_item);
            this.scroll_to(-new_index, 0);
        })

        this.carousel = require('./carousel.hbs')({
            item: item,
            file_size: humanFileSize(item.size)
        }, ctx);

        this.carousel_container = this.carousel.getElementsByClassName('item-carousel')[0];

        window.addEventListener('resize', _ => {
            this.carousel_conitainer.style.width = window.innerWidth + 'px';
            this.carousel_container.style.height = window.innerHeight + 'px';
        })

        this.primary_tile = new ItemTile(this.carousel_container);
        this.secondary_tile = new ItemTile(this.carousel_container);

        this.desired_offset_x = 0;
        this.desired_offset_y = 0;
        this.current_offset_x = 0;
        this.current_offset_y = 0;
        document.body.append(this.carousel);

        this.primary_tile.load()
            .then(() => {
                this.secondary_tile.load().then(() => {
                    this.scroll_to(-directory_content.get_item_index(item.id) + 0.0001, 0, true)
                })
            })

        if (!document.fullscreenEnabled || !document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.onfullscreenchange = () => {
                    if (!document.fullscreenEnabled || !document.fullscreenElement) {
                        delete document.documentElement.onfullscreenchange;
                        this.directory_content.close_carousel();
                    }
                }
                document.documentElement.requestFullscreen();
            }
        }

        document.addEventListener('touchstart', e => {
            this.touchstartX = e.changedTouches[0].screenX - this.get_offset_x() * window.innerWidth
            this.touchstartY = e.changedTouches[0].screenY
        });
        document.addEventListener('touchmove', e => {
            const touchendX = e.changedTouches[0].screenX
            const touchendY = e.changedTouches[0].screenY
            this.scroll_to((touchendX - this.touchstartX) / window.innerWidth, (touchendY - this.touchstartY) / window.innerHeight, true);
            if (e.changedTouches.length > 1) {
                this.touchstartX = touchendX;
                this.touchstartY = touchendY;
            }
        });
        document.addEventListener('touchend', e => {
            this.scroll_to(Math.round(this.get_offset_x()), Math.round(this.get_offset_y()));
        });
    }

    get_offset_x() {
        return this.desired_offset_x;
    }

    get_offset_y() {
        return this.desired_offset_y;
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
        this.current_offset_x = lerp(this.current_offset_x, this.desired_offset_x, Math.min(delta * 20, 1))
        this.current_offset_y = lerp(this.current_offset_y, this.desired_offset_y, Math.min(delta * 20, 1))

        const local_x_offset = this.current_offset_x
        const local_offset_clamped_x = (local_x_offset + (local_x_offset <= 0 ? -Math.floor(local_x_offset / 2) * 2 : 0)) % 2.0;
        const primary_local_offset_x = local_offset_clamped_x >= 1 ? local_offset_clamped_x - 2 : local_offset_clamped_x;
        const secondary_local_offset_x = local_offset_clamped_x >= 0 ? local_offset_clamped_x - 1 : local_offset_clamped_x + 1;

        const absolute_offset_x = primary_local_offset_x * window.innerWidth;
        const secondary_absolute_offset_x = secondary_local_offset_x * window.innerWidth;
        const absolute_offset_y = this.current_offset_y * window.innerHeight;

        let current_index = (-Math.floor(this.current_offset_x) + this.directory_content.objects.length) % this.directory_content.objects.length;
        const current_item = this.directory_content.get_item_at_index(current_index);

        if (local_offset_clamped_x >= 1 || local_offset_clamped_x === 0) {
            this.secondary_tile.set_item(this.directory_content.navigator.filesystem.get_object_data(current_item));
            this.primary_tile.set_item(this.directory_content.navigator.filesystem.get_object_data(this.directory_content.get_item_before(current_item, true)));
        }
        else {
            this.secondary_tile.set_item(this.directory_content.navigator.filesystem.get_object_data(this.directory_content.get_item_before(current_item, true)));
            this.primary_tile.set_item(this.directory_content.navigator.filesystem.get_object_data(current_item));
        }

        if (this.primary_tile.tile && this.primary_tile.tile.style)
            this.primary_tile.tile.style.translate = `${absolute_offset_x}px ${absolute_offset_y}px`;
        if (this.secondary_tile.tile && this.secondary_tile.tile.style)
            this.secondary_tile.tile.style.translate = `${secondary_absolute_offset_x}px ${absolute_offset_y}px`;

        if (Math.abs(this.desired_offset_x - this.current_offset_x) < 1e-5 && Math.abs(this.desired_offset_y - this.current_offset_y) < 1e-5) {
            this.animated = false;
            this.last_frame = null;
            return;
        }
        this.animated = true;
        this.last_frame = performance.now();
        if (this.carousel) {
            window.requestAnimationFrame(() => {
                this._move_window()
            });
        }
        if (Math.abs(this.get_offset_y()) > 0.8)
            this.directory_content.close_carousel();
    }

    close() {
        this.carousel.remove();
        delete this.carousel;
        delete this;
        if (document.fullscreenEnabled || document.fullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {})
            }
        }
    }
}

export {ItemCarousel}