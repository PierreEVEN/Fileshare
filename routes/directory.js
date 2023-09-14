const {error_404, session_data, request_username, error_403} = require("../src/session_utils");
const {logger} = require("../src/logger");
const {Directories} = require("../src/database/directories");
const {Repos} = require("../src/database/repos");


/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    console.log(req.query)
    return;
    if (!req.query.directory) {
        if (session_data(req).selected_repos)
            return res.redirect(`/repos/?repos=${await session_data(req).selected_repos.access_key}`);
        else
            return res.redirect(`/`);
    }

    const directory = await Directories.from_id(req.query.directory);
    if (!directory)
        return error_404(req, res, 'Dossier inexistant');

    req.directory = directory;

    next();
})
/* ###################################### CREATE ROUTER ###################################### */

router.post('/delete/', async (req, res) => {
    if (req.directory.owner !== session_data(req).connected_user.id) {
        const repos = await Repos.from_id(req.directory.repos);
        if (repos.owner !== session_data(req).connected_user.id) {
            return error_403(req, res);
        }
    }
    await req.directory.delete();
    logger.warn(`${request_username(req)} deleted directory ${req.directory.id}`)
    res.sendStatus(200);
});

router.post('/update/', async function (req, res) {

    req.directory.name = req.body.name;
    req.directory.description = req.body.description;
    req.directory.can_guest_upload = req.body.can_guest_upload;

    await req.directory.push();
    logger.warn(`${request_username(req)} updated directory ${req.directory.id}`)
    return res.redirect(session_data(req).selected_repos ? `/repos/?repos=${await session_data(req).selected_repos.access_key}` : '/');
})

module.exports = router;