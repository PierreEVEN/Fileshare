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
    }

    /**
     @param container {HTMLElement}
     */
    build_visual(container) {

        import('../../../../../embed_viewers').then(async _ => {

            const carousel_list = carousel_list_hbs({}, {});
            const carousel_list_div = carousel_list.getElementsByClassName('carousel-list')[0];


            for (const object of this.objects) {
                const meta_data = this.navigator.filesystem.get_object_data(object);
                if (meta_data.is_regular_file) {
                    const item = carousel_list_item_hbs({item:meta_data}, {
                        on_click: () => {
                            if (this.on_select_item)
                                this.on_select_item(meta_data);
                        }
                    });
                    carousel_list_div.append(item);
                }
            }
            container.append(carousel_list);
        });
    }
}

export {CarouselList}