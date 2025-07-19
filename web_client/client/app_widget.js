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
}

export {AppWidget}