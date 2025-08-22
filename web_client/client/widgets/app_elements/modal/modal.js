require('./modal.scss')
const {NavigableAppWidget} = require("../../../src/utilities/navigable");

class ModalContainer extends NavigableAppWidget {
    constructor() {
        super();

        this.addEventListener('click', (element) => {
            if (element.target === this) {
                this.close();
            }
        })
    }

    connectedCallback() {
        super.connectedCallback();
        this.modal_box = document.createElement('div');
        this.modal_box.classList.add('modal-box');
        this.append(this.modal_box)
    }

    close() {
        if (this._create_infos && this._create_infos.on_close)
            this._create_infos.on_close();
        this._create_infos = null;
        this.modal_box.innerHTML = '';
        this.classList.remove('modal-open');
        if (this.get_last_focused_item()) {
            this.get_last_focused_item().focus();
        }
    }

    /**
     * @typedef {Object} CreateInfos
     * @property {string|undefined} modal_class
     * @property {function} on_close
     */

    /**
     * @param content
     * @param create_infos {CreateInfos}
     * @return {HTMLElement}
     */
    open(content, create_infos = {}) {
        this.close();
        this._create_infos = create_infos;
        if (content.constructor.name === 'Array') {
            content[0].append(document.createElement('modal-close'));
            for (const element of content)
                this.modal_box.append(element);
        } else {
            content.append(document.createElement('modal-close'));
            this.modal_box.append(content);
        }
        this.classList.add('modal-open');
        this.modal_box.style.left = 'auto'
        this.modal_box.style.top = 'auto';
        this.focus();
    }

    back() {}

    exit() {
        this.close();
    }

    is_open() {
        return this.classList.contains('modal-open');
    }
}

customElements.define("modal-container", ModalContainer, {});

class ModalClose extends HTMLElement {
    constructor() {
        super();
        this.onclick = () => {
            /**
             * @type {ModalContainer}
             */
            const owning_modal = this.closest('modal-container');
            console.assert(owning_modal, "'modal-close' doesn't belong to a valid 'modal-container'");
            owning_modal.close();
        }
    }
}

customElements.define("modal-close", ModalClose);