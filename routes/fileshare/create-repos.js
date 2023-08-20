const {require_connection, get_user_private_data} = require("../../src/session_utils");
const Repos = require('../../src/database/tables/repos')
const Users = require("../../src/database/tables/user")
const crypto = require("crypto");

function view(req, res) {
    if (require_connection(req, res))
        return;

    res.render('fileshare/fileshare', {
        title: 'Nouveau dépot',
        user: req.session.user,
        force_open_create_repos: true,
    });
}

async function post_create_repos(req, res) {

    if (require_connection(req, res))
        return;

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
    const new_repos = await Repos.insert(name, await Users.find(req.session.user.id), status, access_key)
    req.session.user.my_repos.push(await new_repos.public_data())
    res.redirect(`/fileshare/repos/${access_key}`);
}

async function post_delete_repos(req, res) {

    if (require_connection(req, res))
        return;

    const repos = await Repos.find_access_key(req.params.repos)

    if ((await repos.get_owner()).get_id() !== req.session.user.id)
        return res.redirect(`/fileshare/`);

    await repos.delete();
    req.session.user = await get_user_private_data(await Users.find(req.session.user.id));
    res.redirect(`/fileshare/`);
}

module.exports = {view, post_create_repos, post_delete_repos};