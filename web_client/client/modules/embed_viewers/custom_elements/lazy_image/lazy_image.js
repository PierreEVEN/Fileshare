class LazyImage extends HTMLElement {
    constructor() {
        super();

        this.style.width = '100%';
        this.style.height = '100%';
        this.style.overflowX = 'hidden';
        this.style.overflowY = 'hidden';

        if (!this.hasAttribute('src'))
            return;

        if (this.hasAttribute('alternate-src')) {
            const tmp_image = new Image();
            tmp_image.classList.add('item-large');
            tmp_image.src = this.getAttribute('alternate-src');
            this.append(tmp_image);
        }
        const image = new Image();
        image.src = this.getAttribute('src');
        image.classList.add('item-large');
        image.onload = () => {
            this.innerHTML = '';
            this.append(image);
        }
    }
}

customElements.define("lazy-img", LazyImage);