import {open_modal} from "../../../common/widgets/modal.js";
import {print_message, parse_fetch_result} from "../../../common/widgets/message_box.js";

import signin from './signin.hbs';
import signup from './signup.hbs';

function open_modal_signin() {
    open_modal(signin(), '500px', '450px', 'auth');
}

function open_modal_signup() {
    open_modal(signup(), '500px', '500px', 'auth');
}

async function post_signin() {
    const data = new URLSearchParams();
    data.append('username', document.getElementById('username').value);
    data.append('password', document.getElementById('password').value);
    await parse_fetch_result(await fetch('/signin',
        {
            method: 'POST',
            body: data
        }));
}

async function post_signup() {
    const data = new URLSearchParams();

    if (!document.getElementById('email').validity.valid) {
        await print_message('error', 'Email invalide', 'veuillez spécifier un email valide');
        return;
    }

    data.append('username', document.getElementById('username').value);
    data.append('email', document.getElementById('email').value);
    data.append('password', document.getElementById('password').value);
    await parse_fetch_result(await fetch('/signup',
        {
            method: 'POST',
            body: data
        }));
}

async function logout() {
    await parse_fetch_result(await fetch('/logout/', {method: 'POST'}));
}

window.auth = {open_modal_signin, open_modal_signup, logout, post_signin, post_signup}
export {open_modal_signin, open_modal_signup, logout}