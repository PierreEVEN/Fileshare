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

        this._visual = visual;

        container.append(visual);

        this.scale = 1;
        this.translationX = 0;
        this.translationY = 0;

        this._drag = false;
        this._drag_start_x = 0
        this._drag_start_y = 0

        visual.addEventListener('pointerdown', e => {
            this._drag_start_x = e.clientX;
            this._drag_start_y = e.clientY;
            this._drag = true;
            e.preventDefault();
        })

        visual.addEventListener('pointermove', e => {
            if (this._drag) {
                e.preventDefault();
                this.translationX += (e.clientX - this._drag_start_x) / this.scale;
                this.translationY += (e.clientY - this._drag_start_y) / this.scale;

                this._drag_start_x = e.clientX;
                this._drag_start_y = e.clientY;

                this.update_transform();
            }
        })

        document.addEventListener('pointerup', e => {
            this._drag = false;
        })

        visual.addEventListener("wheel", e => {
            if (e.ctrlKey) {
                e.stopPropagation();
                const zoom = -clamp(e.deltaY, -29, 29) / 100 + 1;
                const bounds = this._visual.getBoundingClientRect();
                const offsetX = (e.clientX - bounds.left) / bounds.width - 0.5;
                const offsetY = 0;//e.clientY - (bounds.height / 2 + bounds.top);

                //const offsetX = e.clientX - (window.innerWidth / 2);
                //const offsetY = e.clientY - (window.innerHeight / 2);

                console.log(offsetX)

                const delta_x = -(offsetX / this.scale) * bounds.width / this.scale * 0.5;
                const delta_y = (offsetY / this.scale)

                this.scale = this.scale * zoom;

                this.translationX += delta_x;
                this.translationY += delta_y;

                this.update_transform();
                e.preventDefault();
            }
        });
    }

    update_transform() {
        this.scale = clamp(this.scale, 1, 50);
        this._visual.style.transform = `scale(${this.scale}) translate(${this.translationX}px, ${this.translationY}px)`;
    }
}

export {CarouselViewport}