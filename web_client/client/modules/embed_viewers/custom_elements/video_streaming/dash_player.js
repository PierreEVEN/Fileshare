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

        const stream = fetch_api(`stream/create`, 'POST', this.item)
            .then(stream_id => {
                const url = `/api/stream/${stream_id}/manifest.mpd`;

                const video_div = document.createElement("video");
                video_div.autoplay = true;
                video_div['data-dashjs-player'] = true;
                video_div.controls = true;
                this.style.width = "100%";
                this.style.height = "100%";
                video_div.style.width = "100%";
                video_div.style.height = "100%";
                this.append(video_div);
                let player = dashjs.MediaPlayer().create();
                player.updateSettings({
                    debug: {
                        logLevel: 0
                    }
                })
                //https://dash.akamaized.net/envivio/Envivio-dash2/manifest.mpd
                player.initialize(video_div, url, true);
            })
            .catch(error => NOTIFICATION.fatal(new Message(error).title("Echec de la création du stream")));
    }
}

customElements.define("dash-player", DashPlayer);