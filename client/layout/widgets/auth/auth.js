import {open_modal} from "../components/modal.js";
import {print_message} from "../components/message_box.js";

require('./auth.scss')

import signin from './signin.hbs';
import signup from './signup.hbs';
import {LOCAL_USER} from "../../../common/tools/user";
import {ClientString} from "../../../common/tools/client_string";

function open_modal_signin() {
    open_modal(signin({}, {
        signin: async (e) => {
            e.preventDefault();
            await LOCAL_USER.login(ClientString.FromClient(document.getElementById('username').value), document.getElementById('password').value);
        }
    }), '500px', '400px', 'auth');
}

function open_modal_signup() {
    open_modal(signup({}, {
        signup: async (e) => {
            e.preventDefault();
            if (!document.getElementById('email').validity.valid) {
                await print_message('error', 'Email invalide', 'veuillez spécifier un email valide');
                return;
            }
            await LOCAL_USER.register(ClientString.FromClient(document.getElementById('username').value), ClientString.FromClient(document.getElementById('email').value), document.getElementById('password').value);
        }
    }), '500px', '450px', 'auth');
}

async function logout() {
    await LOCAL_USER.logout();
}

window.auth = {open_modal_signin, open_modal_signup, logout}
export {open_modal_signin, open_modal_signup, logout}