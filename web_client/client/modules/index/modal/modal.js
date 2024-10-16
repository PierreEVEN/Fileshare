require('./modal.scss')

class Modal {
    constructor() {
        /**
         * @type {boolean}
         * @private
         */
        this._is_open = false;

        const modal_div = require('./modal.hbs')({}, {
            close: (event) => {
                if (event && event.target !== modal_div.elements.root)
                    return;
                this.close();
            }
        });
        document.body.append(modal_div);
        this._elements = modal_div.elements;
    }

    close() {
        this._elements.container.innerHTML = '';
        this._elements.root.classList.remove('display')
        if (this.create_infos.on_close)
            this.create_infos.on_close();
        this._is_open = false;
    }
    /**
     * @typedef {Object} CreateInfos
     * @property {string|undefined} custom_width
     * @property {string|undefined} custom_height
     * @property {string|undefined} modal_class
     * @property {function} on_close
     */

    /**
     * @param content
     * @param create_infos {CreateInfos}
     * @return {HTMLElement}
     */
    open(content, create_infos = {}) {
        this.create_infos = create_infos;
        this._is_open = true;
        this._elements.root.classList.add('display')

        if (create_infos.custom_width)
            this._elements.modal.style.width = create_infos.custom_width;
        else
            this._elements.modal.style.width = 'fit-content';
        if (create_infos.custom_height)
            this._elements.modal.style.height = create_infos.custom_height;
        else
            this._elements.container.style.height = 'fit-content';
        this._elements.container.innerHTML = "";
        if (create_infos.modal_class)
            this._elements.modal.classList.add(create_infos.modal_class)

        if (content.length)
            for (const item of content)
                this._elements.container.append(item);
        else
            this._elements.container.append(content);

        const inputs = this._elements.container.getElementsByTagName('input');
        if (inputs.length !== 0)
            inputs[0].focus();
        return this._elements.container;
    }

    is_open() {
        return this._is_open;
    }

}

let MODAL_SINGLETON = null;

const MODAL = {
    /**
     * @return {boolean}
     */
    is_open: function () {
        return MODAL_SINGLETON && MODAL_SINGLETON.is_open();
    },
    /**
     * @param content {HTMLElement}
     * @param create_infos {CreateInfos}
     * @return {HTMLElement}
     */
    open: function (content, create_infos = {}) {
        if (!MODAL_SINGLETON)
            MODAL_SINGLETON = new Modal();
        return MODAL_SINGLETON.open(content, create_infos);
    },
    close: function () {
        MODAL_SINGLETON.close();
    }
}

export {MODAL}