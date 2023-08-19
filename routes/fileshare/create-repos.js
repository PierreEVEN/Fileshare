const {require_connection} = require("../../src/session_utils");
const Repos = require('../../src/database/tables/repos')
const Users = require("../../src/database/tables/user")
const crypto = require("crypto");

function view(req, res) {
    if (require_connection(req, res))
        return;

    res.render('fileshare/create-repos', {
        title: 'Nouveau dépot',
        user: req.session.user
    });
}

async function post_create_repos(req, res) {
    // Capture the input fields
    let name = req.body.name;
    let status = 'private'
    switch (req.body.type) {
        case 'invisible':
            status = 'hidden';
            break;
        case 'Privé':
            status = 'private';
            break;
        case 'Publique':
            status = 'public';
            break;
    }

    const access_key = crypto.randomBytes(16).toString("hex");
    await Repos.insert(name, await Users.find(req.session.user.id), status, access_key)
    res.redirect(`/fileshare/repos/${access_key}`);
}

module.exports = {view, post_create_repos};