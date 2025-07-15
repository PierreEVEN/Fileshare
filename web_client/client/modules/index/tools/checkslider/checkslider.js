import './checkslider.scss'

class CheckSlider extends HTMLElement {
    constructor() {
        super();
        this.checked = this.hasAttribute('checked');
        this.onclick = () => {
            this._checkbox.checked = !this._checkbox.checked;
            this.checked = this._checkbox.checked;
        }
    }

    connectedCallback() {
        this._checkbox = document.createElement('input');
        this._checkbox.type = "checkbox";
        this._checkbox.onchange = (event) => {
            this.checked = event.target.checked;
        }
        this._checkbox.checked = this.checked;
        this.append(this._checkbox);
        this.append(document.createElement('div'))
    }
}

customElements.define("check-slider", CheckSlider);