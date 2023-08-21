const {require_connection, get_user_private_data, session_data, error_403, public_data, events} = require("../../src/session_utils");
const Repos = require('../../src/database/tables/repos')
const Users = require("../../src/database/tables/user")
const crypto = require("crypto");

async function view(req, res) {
    // Ensure user is connected
    if (require_connection(req, res))
        return;

    // Ensure user has privileges
    if (!await session_data(req).connected_user.can_create_repos())
        return error_403(req, res, "Vous n'avez pas les droits pour créer un dépôt.");

    res.render('fileshare/fileshare', {
        title: 'Nouveau dépot',
        session_data: await session_data(req).client_data(),
        public_data: await public_data(),
        force_open_create_repos: true,
    });
}

async function post_create_repos(req, res) {
    // Ensure user is connected
    if (require_connection(req, res))
        return;

    // Ensure user has privileges
    if (!await session_data(req).connected_user.can_edit_repos())
        return error_403(req, res, "Vous n'avez pas les droits pour créer un dépôt.");

    let name = req.body.name;
    let status = 'hidden'
    switch (req.body.type) {
        case 'Invisible':
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

    // Ensure connected user will refresh data
    session_data(req).connected_user.mark_dirty();
    if (status === 'public')
        public_data().mark_dirty();

    res.redirect(`/fileshare/repos/${access_key}`);
}

async function post_delete_repos(req, res) {
    if (require_connection(req, res))
        return;

    // Ensure user has privileges
    if (!await session_data(req).connected_user.can_edit_repos())
        return error_403(req, res, "Vous n'avez pas les droits pour supprimer un dépôt.");

    // Ensure the user who delete the repos is the owner
    const repos = await Repos.find_access_key(req.params.repos)
    if ((await repos.get_owner()).get_id() !== req.session.user.id)
        return res.redirect(`/fileshare/`);

    await repos.delete();

    // Ensure connected user will refresh data
    events.on_delete_repos(repos);

    res.redirect(`/fileshare/`);
}

module.exports = {view, post_create_repos, post_delete_repos};