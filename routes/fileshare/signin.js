const User = require('../../src/database/tables/user')
const {session_data, public_data} = require("../../src/session_utils");

async function view(req, res) {
    res.render('fileshare/fileshare', {
        title: "Connexion",
        force_login: true,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
    });
}

async function post_signin(req, res) {
    const found_user = await User.find_with_credentials(req.body.username, req.body.password);

    await session_data(req).connect_user(found_user);

    if (found_user)
        res.redirect(req.session.last_url ?  req.session.last_url : '/fileshare');
    else
        console.error("Not Handled - 489745");
}

module.exports = {view, post_signin};