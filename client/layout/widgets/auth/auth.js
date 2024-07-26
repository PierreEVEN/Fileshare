import {open_modal} from "../components/modal.js";
import {print_message} from "../components/message_box.js";

import signin from './signin.hbs';
import signup from './signup.hbs';
import {LOCAL_USER} from "../../../common/tools/user";
import {ClientString} from "../../../common/tools/client_string";

function open_modal_signin() {
    open_modal(signin(), '500px', '400px', 'auth');
}

function open_modal_signup() {
    open_modal(signup(), '500px', '450px', 'auth');
}

async function post_signin() {
    await LOCAL_USER.login(ClientString.FromClient(document.getElementById('username').value), document.getElementById('password').value);
}

async function post_signup() {
    if (!document.getElementById('email').validity.valid) {
        await print_message('error', 'Email invalide', 'veuillez spécifier un email valide');
        return;
    }
    await LOCAL_USER.register(ClientString.FromClient(document.getElementById('username').value), ClientString.FromClient(document.getElementById('email').value), document.getElementById('password').value);
}

async function logout() {
    await LOCAL_USER.logout();
}

window.auth = {open_modal_signin, open_modal_signup, logout, post_signin, post_signup}
export {open_modal_signin, open_modal_signup, logout}