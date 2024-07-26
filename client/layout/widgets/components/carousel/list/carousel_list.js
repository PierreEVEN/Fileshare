const carousel_list_hbs = require('./carousel_list.hbs');
const carousel_list_item_hbs = require('./carousel_list_item.hbs');

class CarouselList {
    /**
     * @param navigator {Navigator}
     * @param on_select_item
     */
    constructor(navigator, on_select_item) {
        this.navigator = navigator;
        /**
         * @type {number[]}
         */
        this.objects = navigator.filesystem.get_objects_in_directory(navigator.get_current_directory());

        this.on_select_item = on_select_item;

        this._last_selected = null;

        this.element_map = new Map();
    }

    select_item(meta_data) {
        if (this._last_selected) {
            this._last_selected.classList.remove('selected');
        }
        this._last_selected = this.element_map.get(meta_data.id);

        this._last_selected.classList.add('selected');

        if (this.on_select_item)
            this.on_select_item(meta_data);
        const bounds = this._last_selected.getBoundingClientRect();
        if (bounds.x + bounds.width / 2 - window.innerWidth / 2 > 0) {
            if (this._last_selected.nextSibling)
                this._last_selected.nextSibling.scrollIntoView({ behavior: "smooth"});
        }
        else
            if (this._last_selected.previousSibling)
                this._last_selected.previousSibling.scrollIntoView({ behavior: "smooth"});
    }

    /**
     @param container {HTMLElement}
     */
    build_visual(container) {
        container.innerHTML = '';
        const carousel_list = carousel_list_hbs({}, {
            move_left: () => {

            },

            move_right: () => {

            }

        });
        const carousel_list_div = carousel_list.getElementsByClassName('carousel-list')[0];

        this.container = carousel_list_div;
        carousel_list_div.addEventListener('wheel', e => {
            carousel_list.scrollLeft += (e.deltaY * 0.5);
        })

        carousel_list_div.innerHTML = '';

        for (const object of this.objects) {
            const meta_data = this.navigator.filesystem.get_object_data(object);
            if (meta_data.is_regular_file) {
                const callbacks = {};
                const item = carousel_list_item_hbs({item: meta_data}, callbacks);
                this.element_map.set(meta_data.id, item)
                callbacks.on_click = () => {
                    this.select_item(meta_data)
                }
                carousel_list_div.append(item);
            }
        }
        container.append(carousel_list);
    }
}

export {CarouselList}