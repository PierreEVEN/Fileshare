import * as dashjs from 'dashjs';
import {fetch_api} from "../../../../utilities/request";
import {Message, NOTIFICATION} from "../../../index/tools/message_box/notification";

class DashPlayer extends HTMLElement {
    constructor() {
        super();

        if (this.hasAttribute('item'))
            this.item = this.getAttribute('item');
    }

    connectedCallback() {
        if (!this.item)
            return;
        fetch_api(`stream/create`, 'POST', this.item)
            .then(stream_id => {
                this.stream_id = stream_id;
                const url = `/api/stream/${stream_id}/manifest/0`;

                const video_div = document.createElement("video");
                video_div.autoplay = true;
                video_div['data-dashjs-player'] = true;
                video_div.controls = true;
                this.style.width = "100%";
                this.style.height = "100%";
                video_div.style.width = "100%";
                video_div.style.height = "100%";
                this.append(video_div);
                this.player = dashjs.MediaPlayer().create();
                this.player.updateSettings({
                    debug: {
                        logLevel: 2
                    }
                })
                this.player.initialize(video_div, url, true, 0);
            })
            .catch(error => NOTIFICATION.fatal(new Message(error).title("Echec de la création du stream")));
    }

    disconnectedCallback() {
        if (this.stream_id)
            fetch_api(`stream/${this.stream_id}/kill`, 'POST')
                .catch(console.error);
        if (this.player)
            this.player.destroy();
        delete this.player;
    }
}

customElements.define("dash-player", DashPlayer);