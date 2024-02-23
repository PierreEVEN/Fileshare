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

class Permissions {
    async can_user_edit_repos(repos) {
        if (!CONNECTED_USER)
            return false;
        return (await fetch(`/${repos.owner.name}/${repos.name}/edit-repos`)).status === 200;
    }
    async can_user_upload_to_repos(repos) {
        if (!CONNECTED_USER)
            return false;
        return (await fetch(`/${repos.owner.name}/${repos.name}/upload-to-repos`)).status === 200;
    }
    async can_user_edit_directory(repos, directory) {
        if (!CONNECTED_USER)
            return false;
        return (await fetch(`/${repos.owner.name}/${repos.name}/tree/${directory.absolute_path()}/edit-directory`)).status === 200;
    }
    async can_user_upload_to_directory(repos, directory) {
        if (!CONNECTED_USER)
            return false;
        return (await fetch(`/${repos.owner.name}/${repos.name}/tree/${directory.absolute_path()}/upload-to-directory`)).status === 200;
    }
    async can_user_edit_file(repos, file) {
        if (!CONNECTED_USER)
            return false;
        return (await fetch(`/${repos.owner.name}/${repos.name}/tree/${file.absolute_path()}/edit-file`)).status === 200;
    }
}
const permissions = new Permissions();
/**
 * @return {{id:number, description:string, name; string, owner:object, status:string, access_key:string, max_file_size:number, visitor_file_lifetime:string, allow_visitor_upload:string}|null}
 */
function __internal_get_current_repos() {
    return (typeof __loaded_current_repos === 'undefined') ? null : __loaded_current_repos;
}
const CURRENT_REPOS = __internal_get_current_repos();

/**
 * @return {{id:number, email; string, name:string, role:string}} */
function __internal_get_user() {
    return (typeof __connected_user === 'undefined') ? null : __connected_user;
}
const CONNECTED_USER = __internal_get_user();

window.utils = {humanFileSize, seconds_to_str, CURRENT_REPOS, CONNECTED_USER, permissions}
export {humanFileSize, seconds_to_str, CURRENT_REPOS, CONNECTED_USER, permissions}