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
        const visual = carousel_item_hbs({item: item});
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