/***********************************************************************************************/
/*                                         UTILS                                               */
/***********************************************************************************************/

const {require_connection, session_data, error_403, public_data, request_username} = require("../../session_utils");
const crypto = require("crypto");
const {Repos} = require("../../database/repos");
const {Directories} = require("../../database/directories");
const {logger} = require("../../logger");
const router = require("express").Router();

router.get('/server-time/', (req, res) => {
    res.send({"server-time": new Date().getTime()})
});


router.post('/create-repos', async (req, res) => {
    // Ensure user is connected
    if (req.local_user == null)
        return error_403(req, res, "Vous devez être connecté.");

    // Ensure user has privileges
    if (!await req.local_user.can_create_repos())
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
    const repos = await new Repos({name: name, owner: req.local_user.id, status: status, access_key: access_key}).push();

    logger.warn(`${request_username(req)} created a new ${status} repos named ${name}`)

    if (repos)
        res.redirect(`/${req.local_user.name}/${repos.name}`);
});

module.exports = router;