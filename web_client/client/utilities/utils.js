const dayjs = require("dayjs")
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

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

function human_readable_timestamp(timestamp) {
    return dayjs.unix(timestamp).locale('fr').format('DD/MM/YYYY - HH:MM:ss');
}

let is_touch = true;
window.addEventListener('mousemove', function mouse_move_detector() {
    is_touch = false;
    window.removeEventListener('mousemove', mouse_move_detector);
});

function is_touch_screen() {
    return window.matchMedia("(pointer: coarse)").matches
}

export {humanFileSize, seconds_to_str, human_readable_timestamp, is_touch_screen}