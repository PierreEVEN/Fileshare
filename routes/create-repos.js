const {require_connection, get_user_private_data, session_data, error_403, public_data, events, request_username} = require("../src/session_utils");
const Repos = require('../src/database/tables/repos')
const crypto = require("crypto");
const {logger} = require("../logger");
const router = require('express').Router();

router.get('/', async (req, res) => {
    // Ensure user is connected
    if (require_connection(req, res))
        return;

    // Ensure user has privileges
    if (!await session_data(req).connected_user.can_edit_repos())
        return error_403(req, res, "Vous n'avez pas les droits pour créer un dépôt.");

    res.render('fileshare', {
        title: 'Nouveau dépot',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        force_open_create_repos: true,
    });
});


router.post('/', async (req, res) => {
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
    await Repos.insert(name, session_data(req).connected_user, status, access_key)

    // Ensure connected user will refresh data
    session_data(req).mark_dirty();
    if (status === 'public')
        public_data().mark_dirty();

    logger.warn(`${request_username(req)} created a new ${status} repos named ${name}`)

    res.redirect(`/repos/?repos=${access_key}`);
});

module.exports = router;