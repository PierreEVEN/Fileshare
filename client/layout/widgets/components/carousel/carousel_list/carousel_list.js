const carousel_list_hbs = require('./carousel_list.hbs');
const carousel_list_item_hbs = require('./carousel_list_item.hbs');

class CarouselList {
    /**
     * @param navigator {Navigator}
     */
    constructor(navigator) {
        this.navigator = navigator;
        /**
         * @type {number[]}
         */
        this.objects = navigator.filesystem.get_objects_in_directory(navigator.get_current_directory());
    }

    /**
     @param container {HTMLElement}
     */
    build_visual(container) {
        const carousel_list = carousel_list_hbs({}, {});
        const carousel_list_div = carousel_list.getElementsByClassName('carousel-list')[0];


        for (const object of this.objects) {
            const meta_data = navigator.filesystem.get_object_data(object);
            if (meta_data.is_regular_file) {
                const item = carousel_list_item_hbs(meta_data, {
                    on_click: () => {

                    }
                });
                carousel_list_div.append(item);
            }
        }
        container.append(carousel_list);
    }
}

export {CarouselList}