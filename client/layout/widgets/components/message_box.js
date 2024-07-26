
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

    let jsonData = undefined;
    try {
        jsonData = await result.text();
        jsonData = JSON.parse(jsonData)
    }
    catch {
    }

    if (jsonData) {
        if (jsonData && jsonData.message)
            print_message(jsonData.message.severity, jsonData.message.title, jsonData.message.content)
        return jsonData;
    }
    else if (result.status) {
        if (result.status !== 200 && result.status !== 201 &&result.status !== 202)
            print_message("Error", "Unknown error", `${result.status} : ${result.statusText}`)
    }
    return jsonData;
}

function close_message() {
    message_box.classList.remove('message-box-open');
    message_box.classList.add('message-box-close');
    message_timeout = null;
}

window.message_box = {print_message, parse_fetch_result, close_message}
export {print_message, parse_fetch_result, close_message}