import {ClientString} from "./client_string";

function humanFileSize(bytes) {
    const thresh = 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' o';
    }

    const units = ['ko', 'Mo', 'Go', 'To', 'Po', 'Eo', 'Zo', 'Yo']
    let u = -1;
    const r = 10;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(1) + ' ' + units[u];
}

function seconds_to_str(in_seconds) {
    const milliseconds = in_seconds * 1000;

    function numberEnding(number) {
        return (number > 1) ? 's' : '';
    }

    let temp = Math.floor(milliseconds / 1000);
    const years = Math.floor(temp / 31536000);
    if (years) {
        return years + ' année' + numberEnding(years);
    }

    const days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        return days + ' jour' + numberEnding(days);
    }
    const hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        return hours + ' heure' + numberEnding(hours);
    }
    const minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        return minutes + ' minute' + numberEnding(minutes);
    }
    const seconds = temp % 60;
    if (seconds) {
        return seconds + ' seconde' + numberEnding(seconds);
    }
    return '0s';
}

class PageContext {
    /**
     * @param data {{
     *      connected_user:{id:number, email: ClientString, name:ClientString, role:string},
     *      display_user:{id:number, name: ClientString},
     *      display_repos:{id:number, description:ClientString, name: ClientString, owner:number, status:string, display_name:ClientString, max_file_size:number, visitor_file_lifetime:number, allow_visitor_upload:number}
     *      request_path:ClientString,
     *  } || null} */

    constructor(data) {
        if (!data)
            return;
        this.connected_user = data.connected_user;
        if (this.connected_user) {
            this.connected_user.name = new ClientString(this.connected_user.name);
            this.connected_user.email = new ClientString(this.connected_user.email);
        }
        this.display_user = data.display_user;
        if (this.display_user) {
            this.display_user.name = new ClientString(this.display_user.name);
        }
        this.display_repos = data.display_repos;
        if (data.display_repos) {
            this.display_repos.name = new ClientString(data.display_repos.name)
            this.display_repos.description = new ClientString(data.display_repos.description)
            this.display_repos.display_name = new ClientString(data.display_repos.display_name)
        }
        this.request_path = ClientString.FromClient(decodeURI(data.request_path));
    }

    repos_path() {
        if (this.display_user && this.display_repos)
            return `/${this.display_user.name.for_url()}/${this.display_repos.name.for_url()}`
        return null;
    }
}

const PAGE_CONTEXT = new PageContext((typeof __PAGE_CONTEXT === 'undefined') ? null : __PAGE_CONTEXT);

class Permissions {
    /**
     * @param repos_url {string}
     * @return {Promise<boolean>}
     */
    async can_user_edit_repos(repos_url) {
        return (await fetch(`${repos_url}/permissions/edit`)).status === 200;
    }

    /**
     * @param repos_url {string}
     * @return {Promise<boolean>}
     */
    async can_user_upload_to_repos(repos_url) {
        return (await fetch(`${repos_url}/permissions/upload`)).status === 200;
    }

    /**
     * @param repos_url {string}
     * @param item_id {string}
     * @return {Promise<boolean>}
     */
    async can_user_edit_item(repos_url, item_id) {
        return (await fetch(`${repos_url}/permissions/edit/${item_id ? item_id : ""}`)).status === 200;
    }

    /**
     * @param repos_url {string}
     * @param object {string}
     * @return {Promise<boolean>}
     */
    async can_user_upload_to_directory(repos_url, object) {
        return (await fetch(`${repos_url}/permissions/upload/${object ? object : ""}`)).status === 200;
    }
}

function is_touch_device() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

const permissions = new Permissions();

window.utils = {humanFileSize, seconds_to_str, PAGE_CONTEXT, permissions}
export {humanFileSize, seconds_to_str, PAGE_CONTEXT, permissions, is_touch_device}