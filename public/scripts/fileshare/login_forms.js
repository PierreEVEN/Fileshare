import {open_modal} from "./modal.js";
import {parse_fetch_result, print_message} from "./utils.js";

function open_modal_signin() {
    const login_content = document.createElement('div')
    login_content.classList.add('modal-content')
    login_content.innerHTML = `
            <h1>Connexion</h1>
            <div class="field">
                <label for='username'>
                <input type="text" name="username" placeholder="Nom / e-mail" id="username" required>
            </div>
            <div class="field">
                <label for='password'>
                <input type="password" name="password" placeholder="Mot de passe" id="password" required>
            </div>

            <input type="submit" value="Se connecter" onclick="module.login_forms.post_signin()">
            <a id="forgot-password" href="mailto: evenpierre@orange.fr">mot de passe oublié</a>
            <div class="separator"></div>
            <div class='bottom-button'>
                <p>Pas encore de compte ?</p> <a href="javascript:module.login_forms.open_modal_signup();">Créer un compte</a>
            </div>`
    open_modal(login_content, '500px', '450px');
}

function open_modal_signup() {
    const login_content = document.createElement('div')
    login_content.classList.add('modal-content')
    login_content.innerHTML = `
            <h1>Créer un compte</h1>
            <div class="field">
                <label for='username'>
                <input type="text" name="username" placeholder="Nom / e-mail" id="username" required>
            </div>
            <div class="field">
                <label for='email'>
                <input type="email" name="email" placeholder="e-mail" id="email" required>
            </div>
            <div class="field">
                <label for='password'>
                <input type="password" name="password" placeholder="Mot de passe" id="password" required>
            </div>

            <input type="submit" value="Créer un compte" onclick="module.login_forms.post_signup()">
            <a id="forgot-password" href="mailto: evenpierre@orange.fr"></a>
            <div class="separator"></div>
             <div class='bottom-button'>
                 <p>Déjà membre ?</p> <a href="javascript:module.login_forms.open_modal_signin();">Se connecter à votre compte</a>
             </div>`
    module.utils.print_message('error', 'Erreur de connexion', 'Mot de passe déjà utilisé')
    open_modal(login_content, '500px', '500px');
}

async function post_signin() {
    const data = new URLSearchParams();
    data.append('username', document.getElementById('username').value);
    data.append('password', document.getElementById('password').value);
    await parse_fetch_result(await fetch('/fileshare/signin',
        {
            method: 'POST',
            body: data
        }));
}

async function post_signup() {
    const data = new URLSearchParams();

    if (!document.getElementById('email').validity.valid)
    {
        await print_message('error', 'Email invalide', 'veuillez spécifier un email valide');
        return;
    }

    data.append('username', document.getElementById('username').value);
    data.append('email', document.getElementById('email').value);
    data.append('password', document.getElementById('password').value);
    await parse_fetch_result(await fetch('/fileshare/signup',
        {
            method: 'POST',
            body: data
        }));
}

function logout() {
    const logout_form = document.createElement('form');
    logout_form.setAttribute('method', 'post');
    logout_form.setAttribute('action', '/fileshare/logout');
    logout_form.style.display = 'hidden';
    document.body.appendChild(logout_form)
    logout_form.submit();
}

module.login_forms = {open_modal_signin, open_modal_signup, logout, post_signin, post_signup}
export {open_modal_signin, open_modal_signup, logout}