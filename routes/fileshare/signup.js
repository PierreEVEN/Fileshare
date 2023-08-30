const User = require("../../src/database/tables/user");
const {session_data, public_data} = require("../../src/session_utils");

async function view(req, res) {
    res.render('fileshare/fileshare', {
        title: "Nouveau compte",
        force_signin: true,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
    });
}

async function post_signup(req, res) {
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;

    if (username && password && email) {

        if (await User.find_with_identifiers(username, email)) {
            return res.status(401).send(JSON.stringify({
                message: {
                    severity: 'error',
                    title: 'Impossible de créer le compte',
                    content: 'Un utilisateur avec le même nom ou le même mot de passe existe déjà'
                }
            }))
        }

        const new_user = await User.insert(email, username, password);

        await session_data(req).connect_user(new_user)

        res.redirect(req.session.last_url ?  req.session.last_url : '/fileshare');
        req.session.last_url = null;
    } else {
        return res.status(401).send(JSON.stringify({
            message: {
                severity: 'error',
                title: 'Erreur de connexion',
                content: 'Informations manquantes'
            }
        }))
    }
}

module.exports = {view, post_signup}