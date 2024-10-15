const carousel_item_hbs = require('./carousel_viewport.hbs')

function clamp(s, a, b) {
    return s < a ? a : s > b ? b : s;
}

class CarouselViewport {
    constructor(container, item) {
        container.innerHTML = '';
        /**
         * @type {HTMLElement}
         */
        const visual = carousel_item_hbs({item: item.display_data()});
        if (item.description && item.description.plain() !== '') {
            import('../../../../../embed_viewers/custom_elements/document/showdown_loader').then(showdown => {
                const directory_description = visual.getElementsByClassName('carousel-description')[0];
                if (directory_description) {
                    directory_description.innerHTML = showdown.convert_text(item.description.plain())
                    directory_description.style.padding = '20px';
                    directory_description.style.display = 'unset';
                }
            });
        }

        container.append(visual);

        this.scale = 1;
        this.translationX = 0;
        this.translationY = 0;

        visual.addEventListener("wheel", e => {
            if (e.ctrlKey) {
                e.stopPropagation();
                const zoom = -clamp(e.deltaY, -29, 29) / 30 + 1;
                this.scale = clamp(this.scale * zoom, 1, 50);
                const offsetX = e.clientX - window.width / 2;
                const offsetY = e.clientY - window.height / 2;
                visual.style.transform = `scale(${this.scale}) translate(${this.translationX}px, ${this.translationY}px)`;
                e.preventDefault();
            }
        });
    }
}

export {CarouselViewport}