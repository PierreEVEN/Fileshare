import {open_modal} from "./modal.js";

function open_modal_signin() {
    const login_content = document.createElement('div')
    login_content.classList.add('modal-content')
    login_content.innerHTML = `
            <h1>Connexion</h1>
            <form action="/fileshare/signin" method="post">
                <div class="field">
                    <label for='username'>
                    <input type="text" name="username" placeholder="Nom / e-mail" id="username" required>
                </div>
                <div class="field">
                    <label for='password'>
                    <input type="password" name="password" placeholder="Mot de passe" id="password" required>
                </div>

                <input type="submit" value="Se connecter">
                <a id="forgot-password" href="mailto: evenpierre@orange.fr">mot de passe oublié</a>
                <div class="separator"></div>
                <div class='bottom-button'>
                    <p>Pas encore de compte ?</p> <a href="javascript:open_modal_signup();">Créer un compte</a>
                </div>
            </form>`
    open_modal(login_content, '500px', '450px');
}

function open_modal_signup() {
    const login_content = document.createElement('div')
    login_content.classList.add('modal-content')
    login_content.innerHTML = `
            <h1>Créer un compte</h1>
            <form action="/fileshare/signup" method="post">
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

                <input type="submit" value="Créer un compte">
                <a id="forgot-password" href="mailto: evenpierre@orange.fr"></a>
                <div class="separator"></div>
                 <div class='bottom-button'>
                     <p>Déjà membre ?</p> <a href="javascript:open_modal_signin();">Se connecter à votre compte</a>
                 </div>
            </form>`
    open_modal(login_content, '500px', '500px');
}

function logout() {
    const logout_form = document.createElement('form');
    logout_form.setAttribute('method', 'post');
    logout_form.setAttribute('action', '/fileshare/logout');
    logout_form.style.display = 'hidden';
    document.body.appendChild(logout_form)
    logout_form.submit();
}

module.login_forms = {open_modal_signin, open_modal_signup, logout}
export {open_modal_signin, open_modal_signup, logout}