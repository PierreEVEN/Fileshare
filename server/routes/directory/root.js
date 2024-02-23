const {error_404, session_data, request_username, error_403} = require("../../session_utils");
const {logger} = require("../../logger");
const {Directories} = require("../../database/directories");
const perms = require("../../permissions");


/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (!req.query.directory)
        return error_404(req, res, 'Dossier inexistant');

    const directory = await Directories.from_id(Number(req.query.directory));
    if (!directory)
        return error_404(req, res, 'Dossier inexistant');

    if (!await perms.can_user_view_directory(directory, req['user'] ? req['user'].id : null))
        return error_403(req, res, 'Accès non autorisé');

    req.directory = directory;

    next();
})
/* ###################################### CREATE ROUTER ###################################### */

router.post('/delete/', async (req, res) => {
    if (!await perms.can_user_edit_directory(req.directory, req.user ? req.user.id : null))
        return error_403(req, res, 'Accès non autorisé');

    await req.directory.delete();
    logger.warn(`${req.log_name} deleted directory ${req.directory.id}`)
    res.sendStatus(200);
});

router.post('/update/', async function (req, res) {

    if (!await perms.can_user_edit_directory(req.directory, req.user ? req.user.id : null))
        return error_403(req, res, 'Accès non autorisé');

    req.directory.name = req.body.name;
    req.directory.description = req.body.description;
    req.directory.open_upload = req.body.open_upload === 'on';

    await req.directory.push();
    logger.warn(`${req.log_name} updated directory ${req.directory.id}`)
    return res.redirect(session_data(req).selected_repos ? `/repos/?repos=${await session_data(req).selected_repos.access_key}` : '/');
})

router.use('/archive/', require('../archive'));

module.exports = router;