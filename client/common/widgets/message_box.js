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

window.message_box = {print_message, parse_fetch_result, close_message}
export {print_message, parse_fetch_result, close_message}