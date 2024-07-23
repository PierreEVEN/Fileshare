const carousel_item_hbs = require('./carousel_item.hbs')

class CarouselItem {
    constructor(container, item) {
        container.innerHTML = '';
        container.append(carousel_item_hbs({item: item}));
    }
}
export {CarouselItem}