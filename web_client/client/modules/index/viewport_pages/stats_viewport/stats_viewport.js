import {humanFileSize} from "../../../../utilities/utils";
import {AppWidget} from "../../../../app_widget";
import {Message, NOTIFICATION} from "../../tools/message_box/notification";

require('./stats_viewport.scss')

class StatsViewport extends AppWidget {

    constructor() {
        super();
    }

    connectedCallback() {


        let content = require('./stats_viewport.hbs')({}, {
            calc_object_sizes: async () => {
                this.pause();
                const result = await this.get_app().fetch_api("administration/recalculate-db-sizes");
                console.log(result)
                NOTIFICATION.info(new Message(JSON.stringify(result)).title("Finished cleanup pass"))
                this.start();
            }
        });
        this._elements = content.hb_elements;

        for (const element of content)
            this.append(element);

        this.start();
        this.refresh_data();

        this.max_workload = 1;

        this.networks = {

        }

        this.disks = {

        }
    }

    start() {
        this.pause();
        this._refresh_interval = setInterval(() => this.refresh_data(), 1000, {});
    }

    pause() {
        if (this._refresh_interval) {
            clearInterval(this._refresh_interval)
            delete this._refresh_interval;
        }
    }

    async refresh_data() {
        let stats = await this.get_app().fetch_api("administration");

        this._elements.categories.innerHTML = ''
        for (const [cat_name, category] of Object.entries(stats.values)) {
            const cat = document.createElement('div');

            const cat_name_div = document.createElement('p');
            cat_name_div.innerText = cat_name;
            const fields = document.createElement('div')

            for (const [field_name, field] of Object.entries(category)) {
                const field_div = document.createElement('div');
                const field_name_div = document.createElement('p');
                field_name_div.innerText = field_name;
                const values = document.createElement('div');
                for (const value of field) {
                    const val_div = document.createElement('p');
                    val_div.innerText = value;
                    values.append(val_div);
                }
                field_div.append(field_name_div);
                field_div.append(values)
                fields.append(field_div);
            }
            cat.append(cat_name_div);
            cat.append(fields)
            this._elements.categories.append(cat);
        }


        if (stats.cpu_usage > this.max_workload) {
            this.max_workload = stats.cpu_usage
        }

        this._elements.workload_bar.style.width = `${stats.cpu_usage * 100 / this.max_workload}%`;
        this._elements.workload_txt.innerText = Math.trunc(stats.cpu_usage * 10000) / 100 + `/${Math.trunc(this.max_workload * 100)}%`;

        this._elements.ram_bar.style.width = `${stats.ram_used / stats.ram_total * 100}%`;
        this._elements.ram_txt.innerText = `${humanFileSize(stats.ram_used)} / ${humanFileSize(stats.ram_total)}`;

        this._elements.swap_bar.style.width = stats.swap_total === 0 ? '0' : `${stats.swap_used / stats.swap_total * 100}%`;
        this._elements.swap_txt.innerText = `${humanFileSize(stats.swap_used)} / ${humanFileSize(stats.swap_total)}`;

        this._elements.cpus.innerHTML = '';
        let num = 0;
        for (const [usage, freq] of stats.cpus) {
            const cpu_div = require("./cpu.hbs")({display_name: `CPU #${num++}`}, {});
            cpu_div.hb_elements.cpu_txt.innerText = `${Math.trunc(usage * 10) / 10}% - ${freq}Ghz`;
            cpu_div.hb_elements.cpu_bar.style.width = `${usage}%`;

            this._elements.cpus.append(cpu_div)
        }

        this._elements.disks.innerHTML = '';
        for (const [name, disk] of Object.entries(stats.disks)) {
            if (!this.disks[name]) {
                this.disks[name] = {max_read: 0, max_write: 0}
            }
            this.disks[name].read = disk.read;
            this.disks[name].write = disk.write;
            if (disk.read > this.disks[name].max_read)
                this.disks[name].max_read = disk.read;
            if (disk.write > this.disks[name].max_write)
                this.disks[name].max_write = disk.write;

            let display_name = name;
            if (display_name === "") {
                display_name = "ROOT";
            }
            const disk_div = require("./disk.hbs")({display_name}, {});
            disk_div.hb_elements.space_txt.innerText = `${humanFileSize(disk.total_space - disk.available_space)} / ${humanFileSize(disk.total_space)}`;
            disk_div.hb_elements.space_bar.style.width = `${(disk.total_space - disk.available_space) / disk.total_space * 100}%`;

            disk_div.hb_elements.read_txt.innerText = `${humanFileSize(disk.read)} / ${humanFileSize(this.disks[name].max_read)}`;
            disk_div.hb_elements.read_bar.style.width = this.disks[name].max_read === 0 ? '0' : `${disk.read / this.disks[name].max_read * 100}%`;

            disk_div.hb_elements.write_txt.innerText = `${humanFileSize(disk.write)} / ${humanFileSize(this.disks[name].max_write)}`;
            disk_div.hb_elements.write_bar.style.width = this.disks[name].max_write === 0 ? '0' : `${disk.write / this.disks[name].max_write * 100}%`;

            this._elements.disks.append(disk_div)
        }

        this._elements.networks.innerHTML = '';
        for (const [name, [up, down]] of Object.entries(stats.network)) {
            if (!this.networks[name]) {
                this.networks[name] = {max_net: 0}
            }
            this.networks[name].read = down;
            this.networks[name].write = up;
            if (down > this.networks[name].max_net)
                this.networks[name].max_net = down;
            if (up > this.networks[name].max_net)
                this.networks[name].max_net = up;

            let display_name = name;
            if (display_name === "") {
                display_name = "ROOT";
            }
            const network_div = require("./networks.hbs")({display_name}, {});

            network_div.hb_elements.up_txt.innerText = `${humanFileSize(up)} / ${humanFileSize(this.networks[name].max_net)}`;
            network_div.hb_elements.up_bar.style.width = this.networks[name].max_net === 0 ? '0' : `${up / this.networks[name].max_net * 100}%`;

            network_div.hb_elements.down_txt.innerText = `${humanFileSize(down)} / ${humanFileSize(this.networks[name].max_net)}`;
            network_div.hb_elements.down_bar.style.width = this.networks[name].max_net === 0 ? '0' : `${down / this.networks[name].max_net * 100}%`;

            this._elements.networks.append(network_div)
        }
    }

    delete() {
        super.delete();
        clearInterval(this._refresh_interval)
        delete this._refresh_interval;
    }
}

customElements.define("page-stats", StatsViewport);

