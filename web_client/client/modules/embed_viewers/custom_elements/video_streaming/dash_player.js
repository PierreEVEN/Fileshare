import * as dashjs from 'dashjs';
import {fetch_api} from "../../../../utilities/request";
import {Message, NOTIFICATION} from "../../../index/tools/message_box/notification";
import {ControlBar} from "./ControlBar";
require('./controlbar.scss')

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

                let elements = require('./dash_player.hbs')({});
                let video_div = elements.hb_elements.video;
                video_div.autoplay = true;
                video_div['data-dashjs-player'] = true;
                video_div.controls = true;
                this.style.width = "100%";
                this.style.height = "100%";
                video_div.style.width = "100%";
                video_div.style.height = "100%";
                for (const element of elements)
                    this.append(element);
                this.player = dashjs.MediaPlayer().create();
                this.player.updateSettings({
                    debug: {
                        logLevel: 2
                    }
                })
                this.player.initialize(video_div, url, true, 0);
                let control_bar = new ControlBar(this.player);
                control_bar.initialize();
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