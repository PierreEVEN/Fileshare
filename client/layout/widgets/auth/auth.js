import {close_modal, open_modal} from "../components/modal.js";
import {parse_fetch_result, print_message} from "../components/message_box.js";

require('./auth.scss')

import signin from './signin.hbs';
import signup from './signup.hbs';
import reset_password from './reset_password.hbs';
import {LOCAL_USER} from "../../../common/tools/user";
import {ClientString} from "../../../common/tools/client_string";

function open_modal_signin() {
    open_modal(signin({}, {
        signin: async (e) => {
            e.preventDefault();
            await LOCAL_USER.login(ClientString.FromClient(document.getElementById('username').value), document.getElementById('password').value);
        },
        reset_password: async (e) => {
            if (document.getElementById('username').value.length === 0)
                return print_message('error', "Spécifiez un utilisateur", "Veuillez spécifier un nom d'utilisateur ou un mail.")
            const res = await parse_fetch_result(await fetch(`/api/reset-password/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({email: ClientString.FromClient(document.getElementById('username').value)})
            }));
            if (!res.message)
                print_message('info', 'Mail de réinitialisation envoyé', 'Vérifiez votre boite mail pour poursuivre la procédure de réinitialisation');
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

function open_modal_reset_password(reset_token) {
    open_modal(reset_password({}, {
        reset: async (e) => {
            e.preventDefault();
            const res = await parse_fetch_result(await fetch(`/api/reset-password/${reset_token}/`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        password: String(document.getElementById('password').value),
                    })
                }));
            if (!res.message)
                print_message('info', "Mot de passe réinitialisé", "Connectez vous avez votre nouveau mot de passe");
            location.href = '/'
        }
    }), '500px', '250px', 'auth');
}

async function logout() {
    await LOCAL_USER.logout();
}

window.auth = {open_modal_signin, open_modal_signup, logout, open_modal_reset_password}
export {open_modal_signin, open_modal_signup, logout}