import {AppWidget} from "../../../src/app_widget";
require('./controlbar.scss')

class DashPlayer extends AppWidget {
    constructor() {
        super();
        if (this.hasAttribute('item'))
            this.item = this.getAttribute('item');
    }

    connectedCallback() {
        if (!this.item)
            return;
        this._stopped = false;
        this.app = this.get_app();
        this.app.fetch_api(`stream/create/${this.item}`, 'POST', this.item)
            .then(async stream_id => {
                if (!this._stopped)
                    await this._init(stream_id);
            })
    }

    disconnectedCallback() {
        this._stopped = true;
        if (this.control_bar)
            this.control_bar.destroy();
        if (this.player)
            this.player.destroy();
        delete this.control_bar;
        delete this.player;
    }

    async _init(stream_id) {
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

        import("dashjs").then(async dashjs => {
            if (this._stopped)
                return;
            this.player = dashjs.MediaPlayer().create();
            this.player.updateSettings({
                debug: {
                    logLevel: 2
                },
                streaming: {
                    abr: {
                        autoSwitchBitrate: { audio: false, video: false },
                        initialBitrate: { audio: 800000000, video: 800000000 }
                    }
                }
            })

            this.player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
                const video_rep = this.player.getRepresentationsByType('video');
                if (video_rep && video_rep.length > 0) {
                    const highest = video_rep[video_rep.length - 1];
                    this.player.setRepresentationForTypeById('video', highest.id);
                }
                const audio_rep = this.player.getRepresentationsByType('audio');
                if (audio_rep && audio_rep.length > 0) {
                    const highest = audio_rep[audio_rep.length - 1];
                    this.player.setRepresentationForTypeById('audio', highest.id);
                }
            });

            this.player.initialize(video_div, url, true, 0);

            video_div.onclick = () => {
                if (this.player.isPaused())
                    this.player.play();
                else
                    this.player.pause();
            }

            const control_bar = await import("./control_bar");

            if (!this.player || this._stopped)
                return;
            this.control_bar = new control_bar.ControlBar(this.player, false, elements.hb_elements);
            this.control_bar.initialize();
            video_div.ondblclick = () => {
                if (this.control_bar.isFullscreen())
                    this.control_bar.exitFullscreen();
                else
                    this.control_bar.enterFullscreen();
            }
        });
    }
}

customElements.define("dash-player", DashPlayer);