class AppWidget extends HTMLElement {
    /**
     * @return {FileshareApp}
     */
    get_app() {
        if (!this.isConnected)
            console.error("Cannot get app : widget is not attached");

        if (!this.__cache_app) {
            this.__cache_app = this.closest('fileshare-app');
            if (!this.__cache_app)
                console.error("Cannot get app in parent hierarchy");
        }
        return this.__cache_app;
    }

    /**
     * @param div {Object|function}
     * @param context {Object}
     * @param callbacks {Object}
     * @return {Object}
     */
    set_content(div, context = {}, callbacks = {}) {
        this.innerHTML = '';
        const elements = div(context, callbacks);
        this._elements = elements.hb_elements
        if (elements.constructor.name === 'Array')
            for (const element of elements)
                this.append(element);
        else
            this.append(elements);
        return this._elements
    }

    elements() {
        return this._elements;
    }
}

export {AppWidget}