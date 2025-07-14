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

        this._touch_cache = new Map();

        container.addEventListener('touchstart', e => {
            this._update_touches(e)
        });
        document.addEventListener('touchmove', e => {
            this._update_touches(e)
        });
        const touch_end = e => {
            this._update_touches(e)
        };
        document.addEventListener('touchend', touch_end);
        document.addEventListener('touchcancel', touch_end);

        visual.addEventListener('pointerdown', e => {
            this._drag_start_x = e.clientX;
            this._drag_start_y = e.clientY;
            this._drag = true
        })
        container.addEventListener('pointermove', e => {
            if (this._drag) {
                this.update_transform();

                this.translationX += (e.clientX - this._drag_start_x);
                this.translationY += (e.clientY - this._drag_start_y);

                this._drag_start_x = e.clientX;
                this._drag_start_y = e.clientY;
            }
        })

        const remove_pointer = _ => {
            this._drag = false;
        };
        document.addEventListener('pointerup', remove_pointer)
        document.addEventListener('pointercancel', remove_pointer)
        document.addEventListener('pointerout', remove_pointer)
        document.addEventListener('pointerleave', remove_pointer)

        container.addEventListener("wheel", e => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();

                const zoom = -clamp(e.deltaY, -29, 29) / 100 + 1;
                this._apply_zoom(this.scale * zoom, e.clientX, e.clientY);
            }
        });
    }

    _apply_zoom(zoom, client_x, client_y) {
        const bounds = this._visual.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0)
            return;
        const pointer_x = clamp((client_x - bounds.left) / bounds.width * 2 - 1, -1, 1);
        const pointer_y = clamp((client_y - bounds.top) / bounds.height * 2 - 1, -1, 1);

        const old_scale = this.scale;
        this.scale = clamp(zoom, 1, 50);

        const delta_x = (this._visual.offsetWidth * old_scale - this._visual.offsetWidth * this.scale) * 0.5;
        const delta_y = (this._visual.offsetHeight * old_scale - this._visual.offsetHeight * this.scale) * 0.5;

        this.translationX += delta_x * pointer_x;
        this.translationY += delta_y * pointer_y;

        this.update_transform();
    }

    static _compute_scale(e1, e2) {
        return Math.sqrt((e1.screenX - e2.screenX) * (e1.screenX - e2.screenX) + (e1.screenY - e2.screenY) * (e1.screenY - e2.screenY));
    }

    _update_touches(e) {

        const touches = new Set();

        for (const touch of e.touches) {
            touches.add(touch.identifier);
            const old = this._touch_cache.get(touch.identifier);
            this._touch_cache.set(touch.identifier, {last: old ? old.now : null, now: touch})
        }
        for (const touch of this._touch_cache.keys())
            if (!touches.has(touch))
                this._touch_cache.delete(touch);

        if (this._touch_cache.size === 2) {
            const keys = Array.from(this._touch_cache.values());
            if (!keys[0].last || !keys[1].last)
                return;
            const last_scale = CarouselViewport._compute_scale(keys[0].last, keys[1].last);
            const new_scale = CarouselViewport._compute_scale(keys[0].now, keys[1].now);

            this.translationX += ((keys[0].now.screenX - keys[0].last.screenX) + (keys[1].now.screenX - keys[1].last.screenX)) / 2;
            this.translationY += ((keys[0].now.screenY - keys[0].last.screenY) + (keys[1].now.screenY - keys[1].last.screenY)) / 2;
            this.update_transform();

            this._apply_zoom(this.scale + (new_scale - last_scale) / this._visual.offsetHeight * 2, (keys[0].now.screenX + keys[1].now.screenX) / 2, (keys[0].now.screenY + keys[1].now.screenY) / 2)
            return true;
        }
        return false;
    }

    update_transform() {
        this.translationX = clamp(this.translationX, this._visual.offsetWidth * (-this.scale + 1) * 0.5, this._visual.offsetWidth * (this.scale - 1) * 0.5)
        this.translationY = clamp(this.translationY, this._visual.offsetHeight * (-this.scale + 1) * 0.5, this._visual.offsetHeight * (this.scale - 1) * 0.5)
        this._visual.style.transform = `translate(${this.translationX}px, ${this.translationY}px) scale(${this.scale})`;
    }
}

export {CarouselViewport}