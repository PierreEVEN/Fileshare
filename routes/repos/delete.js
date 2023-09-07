const {require_connection, session_data, error_403, request_username} = require("../../src/session_utils");
const {logger} = require("../../src/logger");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (require_connection(req, res))
        return;

    // Ensure user is the owner
    if (session_data(req).connected_user.get_id() !== (await req.repos.get_owner()).get_id())
        return error_403(req, res, "Seul le propriétaire d'un dépôt peut le supprimer.");

    next();
});
/* ###################################### CREATE ROUTER ###################################### */

router.get('/', async (req, res) => {
    res.redirect(`/repos/?repos=${await req.repos.get_access_key()}`);
})

router.post('/', async (req, res) => {
    await events.on_delete_repos(req.repos);

    logger.warn(`${request_username(req)} deleted repos ${await req.repos.get_access_key()}`)

    res.redirect(`/`);
})

module.exports = router;