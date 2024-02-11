import {open_modal} from "../../../common/widgets/modal.js";
import {print_message, parse_fetch_result} from "../../../common/widgets/message_box.js";

import signin from './signin.hbs';
import signup from './signup.hbs';
import {LOCAL_USER} from "../../../common/tools/user";

function open_modal_signin() {
    open_modal(signin(), '500px', '400px', 'auth');
}

function open_modal_signup() {
    open_modal(signup(), '500px', '450px', 'auth');
}

async function post_signin() {
    await LOCAL_USER.login(document.getElementById('username').value, document.getElementById('password').value);
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
    await parse_fetch_result(await fetch('/auth/signup',
        {
            method: 'POST',
            body: data
        }));
}

async function logout() {
    await LOCAL_USER.logout();
}

window.auth = {open_modal_signin, open_modal_signup, logout, post_signin, post_signup}
export {open_modal_signin, open_modal_signup, logout}