const carousel_list_hbs = require('./carousel_list.hbs');
const carousel_list_item_hbs = require('./carousel_list_item.hbs');

class CarouselList {
    /**
     * @param viewport {RepositoryViewport}
     * @param on_select_item
     */
    constructor(viewport, on_select_item) {
        this.viewport = viewport;

        this.on_select_item = on_select_item;

        this._last_selected = null;

        this.element_map = new Map();
    }

    select_item(meta_data, scroll_center = false) {
        if (this._last_selected) {
            this._last_selected.classList.remove('selected');
        }
        this._last_selected = this.element_map.get(meta_data.id);

        if (!this._last_selected)
            return;
        this._last_selected.classList.add('selected');

        if (this.on_select_item)
            this.on_select_item(meta_data);
        this._last_selected.scrollIntoView({behavior: "smooth", inline: scroll_center ? 'center' : 'nearest'});
        this.update_left_right_buttons();
    }

    async select_next() {
        const meta_data = await this.viewport.content.get_filesystem().fetch_item(this._last_selected.nextSibling.item_id);
        if (meta_data.is_regular_file) {
            this.select_item(meta_data, true);
        }
    }

    async select_previous() {
        const meta_data = await this.viewport.content.get_filesystem().fetch_item(this._last_selected.previousSibling.item_id);
        if (meta_data.is_regular_file) {
            this.select_item(meta_data, true);
        }
    }

    /**
     @param container {HTMLElement}
     */
    async build_visual(container) {
        container.innerHTML = '';
        const carousel_list = carousel_list_hbs({}, {
            move_left: () => {
                this.select_previous();
            },
            move_right: () => {
                this.select_next();
            }
        });
        this.move_left_button = carousel_list.getElementsByClassName('carousel-move-left')[0];
        this.move_right_button = carousel_list.getElementsByClassName('carousel-move-right')[0];

        const carousel_list_div = carousel_list.getElementsByClassName('carousel-list')[0];

        this.container = carousel_list_div;
        carousel_list_div.addEventListener('wheel', e => {
            carousel_list.scrollLeft += (e.deltaY * 0.5);
        })

        carousel_list_div.innerHTML = '';

        const left_spacer = document.createElement('div');
        left_spacer.style.width = '100px';
        carousel_list_div.append(left_spacer);

        let provider = this.viewport.content.get_content_provider();
        if (!provider)
            return;

        for (const object of await provider.get_content()) {
            if (object.is_regular_file) {
                const callbacks = {};
                const item = carousel_list_item_hbs({item: object.display_data()}, callbacks);
                this.element_map.set(object.id, item);
                callbacks.on_click = () => {
                    this.select_item(object)
                }
                item.item_id = object.id;
                carousel_list_div.append(item);
            }
        }

        const right_spacer = document.createElement('div');
        right_spacer.style.width = '100px';
        carousel_list_div.append(right_spacer);
        container.append(carousel_list);
        this.update_left_right_buttons();
    }

    update_left_right_buttons() {
        if (this.move_left_button) {
            if (!this._last_selected || !this._last_selected.previousSibling.classList.contains('carousel-item'))
                this.move_left_button.style.display = 'none';
            else
                this.move_left_button.style.display = 'unset';
        }
        if (this.move_right_button) {
            if (!this._last_selected || !this._last_selected.nextSibling.classList.contains('carousel-item'))
                this.move_right_button.style.display = 'none';
            else
                this.move_right_button.style.display = 'unset';
        }
    }
}

export {CarouselList}