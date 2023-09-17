const {require_connection, session_data, error_403, request_username} = require("../../session_utils");
const {logger} = require("../../logger");
const {Repos} = require("../../database/repos");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (require_connection(req, res))
        return;

    // Ensure user is the owner
    if (session_data(req).connected_user.id !== req.file.owner)
        return error_403(req, res, "Seul le propriétaire d'un fichier peut le supprimer.");

    next();
});
/* ###################################### CREATE ROUTER ###################################### */

router.get('/', async (req, res) => {
    const repos = await Repos.from_id(req.file.repos)
    res.redirect(`/repos/?repos=${repos.access_key}`);
})

router.post('/', async (req, res) => {
    await req.file.delete();

    logger.warn(`${request_username(req)} deleted file ${req.file.id}`)

    await res.status(200).send();
})

module.exports = router;