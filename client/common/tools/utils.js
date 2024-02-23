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
        return years + ' années' + numberEnding(years);
    }

    const days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        return days + ' jours' + numberEnding(days);
    }
    const hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        return hours + ' heures' + numberEnding(hours);
    }
    const minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        return minutes + ' minutes' + numberEnding(minutes);
    }
    const seconds = temp % 60;
    if (seconds) {
        return seconds + ' secondes' + numberEnding(seconds);
    }
    return '0s';
}

class PageContext {
    /**
     * @param data {{
     *      connected_user:{id:number, email; string, name:string, role:string},
     *      display_user:{id:number, description:string, name; string, owner:number, status:string, access_key:string, max_file_size:number, visitor_file_lifetime:string, allow_visitor_upload:string},
     *      display_repos:{id:number, description:string, name; string, owner:number, status:string, access_key:string, max_file_size:number, visitor_file_lifetime:string, allow_visitor_upload:string}
     *  } || null} */

    constructor(data) {
        if (!data)
            return;
        this.connected_user = data.connected_user;
        this.display_user = data.display_user;
        this.display_repos = data.display_repos;
    }

    repos_path() {
        if (this.display_user && this.display_repos)
            return `/${this.display_user.name}/${this.display_repos.name}`
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
        return (await fetch(`${repos_url}/can-edit`)).status === 200;
    }

    /**
     * @param repos_url {string}
     * @return {Promise<boolean>}
     */
    async can_user_upload_to_repos(repos_url) {
        return (await fetch(`${repos_url}/can-upload`)).status === 200;
    }

    /**
     * @param repos_url {string}
     * @param path {string}
     * @return {Promise<boolean>}
     */
    async can_user_edit_path(repos_url, path) {
        return (await fetch(`/permissions/edit-directory?directory=${directory}`)).status === 200;
    }

    /**
     * @param repos_url {string}
     * @param path {string}
     * @return {Promise<boolean>}
     */
    async can_user_upload_to_path(repos_url, path) {
        return (await fetch(`/permissions/upload-to-directory?directory=${directory}`)).status === 200;
    }
}

const permissions = new Permissions();

window.utils = {humanFileSize, seconds_to_str, PAGE_CONTEXT, permissions}
export {humanFileSize, seconds_to_str, PAGE_CONTEXT, permissions}