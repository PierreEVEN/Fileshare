const User = require('../../src/database/tables/user')
const {get_user_private_data} = require("../../src/session_utils");

function view(req, res) {
    res.render('fileshare/fileshare', {title: "Connexion", force_login: true});
}

async function post_signin(req, res) {
    const found_user = await User.find_with_credentials(req.body.username, req.body.password);
    if (found_user) {
        req.session.user = await get_user_private_data(found_user);
        res.redirect( req.session.last_url ?  req.session.last_url : '/fileshare');
        req.session.last_url = null;
    }
    else {
        res.render('fileshare/signin', {
            title: 'Connexion - Mauvais identifiants',
            error: 'Aucun compte ne correspond à ces identifiants'
        });
    }
}

module.exports = {view, post_signin};