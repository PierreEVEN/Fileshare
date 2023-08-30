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

const message_box = document.getElementById('message-box')
const message_box_message = document.getElementById('message-box-message')
let message_timeout = null;

function print_message(severity, title, message) {
    console.warn(`Message [${severity}] : ${title}\n${message}`)
    message_box.classList.add('message-box-open');
    message_box.classList.remove('message-box-close');
    message_box.querySelector('h1').innerText = title;
    message_box_message.innerText = message;
    if (message_timeout)
        clearTimeout(message_timeout)
    message_timeout = setTimeout(() => {
        message_box.classList.remove('message-box-open');
        message_box.classList.add('message-box-close');
        message_timeout = null;
    }, 15000)
}

async function parse_fetch_result(result) {
    if (result.redirected) {
        window.location.href = result.url;
        return null;
    }

    const data = result.json ? await result.json() : result.response ? JSON.parse(result.response) : null;
    if (data && data.message)
        print_message(data.message.severity, data.message.title, data.message.content)
    return data;
}

function close_message() {
    message_box.classList.remove('message-box-open');
    message_box.classList.add('message-box-close');
    message_timeout = null;
}

module.utils = {humanFileSize, seconds_to_str, print_message, parse_fetch_result, close_message}

export {humanFileSize, seconds_to_str, print_message, parse_fetch_result, close_message}