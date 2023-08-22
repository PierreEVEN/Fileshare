const User = require("../../src/database/tables/user");
const {session_data, public_data} = require("../../src/session_utils");

async function view(req, res) {
    res.render('account/signup', {
        title: "Nouveau compte",
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
            return console.error("Not Handled - 58789879435");
        }

        const new_user = await User.insert(email, username, password);

        await session_data(req).connect_user(new_user)

        res.redirect(req.session.last_url ?  req.session.last_url : '/fileshare');
        req.session.last_url = null;
    } else {
        return console.error("Not Handled - 5648979846");
    }
}

module.exports = {view, post_signup}