import {open_modal} from "../../widgets/modal.js";
import {print_message, parse_fetch_result} from "../../widgets/message_box.js";

import signin from './signin.hbs';
import signup from './signup.hbs';
console.log('LOADED DATA : ', signin());

async function open_modal_signin() {
    open_modal(await window.handlebars.render('auth/signin', {
        submit: async () => {
            const data = new URLSearchParams();
            data.append('username', document.getElementById('username').value);
            data.append('password', document.getElementById('password').value);
            await parse_fetch_result(await fetch('/signin',
                {
                    method: 'POST',
                    body: data
                }));
        }
    }), '500px', '450px');
}

async function open_modal_signup() {
    open_modal(await window.handlebars.render('auth/signup'), '500px', '500px');
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