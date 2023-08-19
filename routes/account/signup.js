const User = require("../../src/database/tables/user");
const {get_user_private_data} = require("../../src/session_utils");

function view(req, res) {
    res.render('account/signup', {title: "Nouveau compte"});
}

async function post_signup(req, res) {
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;

    if (username && password && email) {

        if (await User.find_with_identifiers(username, email)) {
            return res.render('account/signup', {
                title: 'Connexion - Utilisateur existe',
                error: 'Nom ou email déjà pris'
            });
        }

        const new_user = await User.insert(email, username, password);

        req.session.user = await get_user_private_data(new_user);
        res.redirect( req.session.last_url ?  req.session.last_url : '/fileshare');
        req.session.last_url = null;
    } else {
        res.render('account/signup', {
            title: 'Nouveau compte - Missing fields',
            error: 'Veuillez remplir tous les champs requis'
        });
    }
}

module.exports = {view, post_signup}