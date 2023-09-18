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

const CURRENT_REPOS = __loaded_current_repos ? {
    id: __loaded_current_repos.id,
    name: __loaded_current_repos.name,
    access_key: __loaded_current_repos.access_key,
} : null;

window.utils = {humanFileSize, seconds_to_str, CURRENT_REPOS}
export {humanFileSize, seconds_to_str, CURRENT_REPOS}