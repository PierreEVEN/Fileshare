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
            e.preventDefault();
            this._drag_start_x = e.clientX;
            this._drag_start_y = e.clientY;
            this._drag = true;
        })

        container.addEventListener('pointermove', e => {
            if (this._drag) {
                e.preventDefault();
                this.translationX += (e.clientX - this._drag_start_x);
                this.translationY += (e.clientY - this._drag_start_y);

                this._drag_start_x = e.clientX;
                this._drag_start_y = e.clientY;

                this.update_transform();
            }
        })

        document.addEventListener('pointerup', e => {
            this._drag = false;
        })

        container.addEventListener("wheel", e => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                const bounds = this._visual.getBoundingClientRect();
                if (bounds.width === 0 || bounds.height === 0)
                    return;

                const old_scale = this.scale;
                const zoom = -clamp(e.deltaY, -29, 29) / 100 + 1;
                this.scale = clamp(this.scale * zoom, 1, 50);

                const pointer_x = clamp((e.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
                const pointer_y = clamp((e.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);

                const delta_x = (this._visual.offsetWidth * old_scale - this._visual.offsetWidth * this.scale) * 0.5;
                const delta_y = (this._visual.offsetHeight * old_scale - this._visual.offsetHeight * this.scale) * 0.5;

                this.translationX += delta_x * pointer_x;
                this.translationY += delta_y * pointer_y;

                this.update_transform();
            }
        });
    }

    update_transform() {
        this.translationX = clamp(this.translationX, this._visual.offsetWidth * (-this.scale + 1) * 0.5, this._visual.offsetWidth * (this.scale - 1) * 0.5)
        this.translationY = clamp(this.translationY, this._visual.offsetHeight * (-this.scale + 1) * 0.5, this._visual.offsetHeight * (this.scale - 1) * 0.5)
        this._visual.style.transform = `translate(${this.translationX}px, ${this.translationY}px) scale(${this.scale})`;
    }
}

export {CarouselViewport}