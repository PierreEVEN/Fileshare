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

function mime_icon(mimetype) {
    if (!mimetype)
        return '/images/icons/mime-icons/no-mime-icon.png';

    const left = mimetype.split('/')[0];
    const right = mimetype.split('/')[1];
    switch (left) {
        case 'application':
            switch (right) {
                case 'x-pdf':
                case 'pdf':
                    return '/images/icons/mime-icons/application/pdf.png';
                case 'json':
                    return '/images/icons/mime-icons/application/json.png';
                case 'javascript':
                case 'x-javascript':
                    return '/images/icons/mime-icons/application/javascript.png';
                default:
                    break;
            }
            return '/images/icons/mime-icons/application.png';
        case 'audio':
            return '/images/icons/mime-icons/audio.png';
        case 'chemical':
            return '/images/icons/mime-icons/chemical.png';
        case 'font':
            return '/images/icons/mime-icons/font.png';
        case 'gcode':
            return '/images/icons/mime-icons/gcode.png';
        case 'image':
            return '/images/icons/mime-icons/image.png';
        case 'message':
            return '/images/icons/mime-icons/message.png';
        case 'model':
            return '/images/icons/mime-icons/model.png';
        case 'text':
            switch (right) {
                case 'plain':
                    return '/images/icons/mime-icons/text/plain.png';
                case 'jade':
                    return '/images/icons/mime-icons/text/template.png';
                case 'css':
                    return '/images/icons/mime-icons/text/css.png';
                case 'markdown':
                    return '/images/icons/mime-icons/text/markdown.png';
                default:
                    break;
            }
            return '/images/icons/mime-icons/text.png';
        case 'video':
            return '/images/icons/mime-icons/video.png';
        case 'x-conference':
            return '/images/icons/mime-icons/x-conference.png';
        default:
            break;
    }

    return '/images/icons/mime-icons/no-mime-icon.png';
}

module.utils = {humanFileSize, seconds_to_str, mime_icon}

export {humanFileSize, seconds_to_str, mime_icon}