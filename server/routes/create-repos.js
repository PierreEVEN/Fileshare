const {require_connection, session_data, error_403, public_data, request_username} = require("../session_utils");
const {Repos} = require('../database/repos')
const crypto = require("crypto");
const {logger} = require("../logger");
const {Directories} = require("../database/directories");
const router = require('express').Router();

router.get('/', async (req, res) => {
    // Ensure user is connected
    if (require_connection(req, res))
        return;

    // Ensure user has privileges
    if (!session_data(req).connected_user.can_create_repos())
        return error_403(req, res, "Vous n'avez pas les droits pour créer un dépôt.");

    res.render('fileshare', {
        title: 'Nouveau dépot',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        force_open_create_repos: true
    });
});


router.post('/', async (req, res) => {
    // Ensure user is connected
    if (require_connection(req, res))
        return;

    // Ensure user has privileges
    if (!await session_data(req).connected_user.can_create_repos())
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
    const repos = await new Repos({name: name, owner: session_data(req).connected_user.id, status: status, access_key: access_key}).push();
    await new Directories({repos: repos.id, })

    // Ensure connected user will refresh data
    session_data(req).mark_dirty();
    if (status === 'public')
        public_data().mark_dirty();

    logger.warn(`${request_username(req)} created a new ${status} repos named ${name}`)

    res.redirect(`/repos/?repos=${access_key}`);
});

module.exports = router;