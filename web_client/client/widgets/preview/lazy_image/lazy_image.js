import {Message, NOTIFICATION} from "../../misc/message_box/notification";

require('./lazy_img.scss')

class LazyImage extends HTMLElement {
    constructor() {
        super();

        if (!this.hasAttribute('src'))
            return;

        this._delay = 50;
    }

    connectedCallback() {
        if (this.hasAttribute('alternate-src')) {
            this.alternate_src = this.getAttribute('alternate-src');
            this.set_image(this.alternate_src)
        }
        this._update_content(this.getAttribute('src'))
            .catch(err => console.error("Failed to load thumbnail :", err));
    }

    set_image(url) {
        if (this.loading) {
            this.loading.remove();
            delete this.loading;
        }
        if (!this.image) {
            this.image = document.createElement("img");
            this.image.draggable = false;
            if (this.hasAttribute('alt'))
                this.image.alt = this.getAttribute('alt');
            this.append(this.image);
        }
        this.image.src = url;
    }

    set_loading(soon) {
        if (this.image) {
            this.image.remove();
            delete this.image;
        }
        if (!this.loading) {
            this.loading = document.createElement("div");
            this.loading.classList.add("loading");
            this.append(this.loading);
        }
        if (soon)
            this.loading.classList.add("soon");
        else
            this.loading.classList.remove("soon");
    }

    async _update_content(src) {
        if (!this.isConnected)
            return;
        let res = await fetch(src, {cache: 'force-cache'});

        this._delay = Math.min(2000, this._delay * 1.5);

        if (res.status !== 200) {
            NOTIFICATION.error(new Message(await res.text()).title("Failed to get thumbnail"));
            this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
            return;
        }

        const content_type = res.headers.get('Content-Type');

        if (content_type?.startsWith('image/')) {
            this.set_image(URL.createObjectURL(await res.blob()))
        } else if (content_type?.includes('json')) {
            const json = await res.json();
            if (json.status === 'no_source') {
                this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
            } else if (json.status === 'unsupported') {
                this.set_image(this.alternate_src);
            } else if (json.status === 'in_queue') {
                this.set_loading(false);
                setTimeout(() => this._update_content(src), this._delay);
            } else if (json.status === 'in_generation') {
                this.set_loading(true);
                setTimeout(() => this._update_content(src), this._delay);
            } else if (json.status === 'unknown_status') {
                this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
                setTimeout(() => this._update_content(src), this._delay);
            } else if (json.status === 'failed') {
                this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
            } else {
                NOTIFICATION.error(new Message(`Invalid response for thumbnail ${this.src}`).title("Invalid response value"));
                this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
            }
        } else {
            NOTIFICATION.error(new Message(`Invalid response for thumbnail ${this.src} : ${content_type}`).title("Invalid response type"));
            this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
        }
    } catch (err) {
        NOTIFICATION.error(new Message(err).title(`Failed to display thumbnail ${this.src}`));
        this.set_image('/public/images/icons/icons8-pas-dimage-48.png');
    }
}

customElements.define("lazy-img", LazyImage);