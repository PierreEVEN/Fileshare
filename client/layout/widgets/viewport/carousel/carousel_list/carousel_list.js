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
        container.append(carousel_list);
        const carousel_list_div = document.getElementById('carousel-list');


        for (const object of this.objects) {
            const meta_data = navigator.filesystem.get_object_data(object);
            if (meta_data.is_regular_file) {
                carousel_list_item_hbs({meta_data}, {
                    on_click: () => {

                    }
                });
            }
        }
    }
}