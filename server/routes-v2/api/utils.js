/***********************************************************************************************/
/*                                         UTILS                                               */
/***********************************************************************************************/

const {error_403} = require("../../session_utils");
const {Repos} = require("../../database/repos");
const {logger} = require("../../logger");
const {display_name_to_url} = require("../../db_utils");
const router = require("express").Router();

router.get('/server-time/', (req, res) => {
    res.send({"server-time": new Date().getTime()})
});

router.post('/create-repos', async (req, res) => {
    // Ensure user is connected
    if (req.connected_user == null)
        return error_403(req, res, "Vous devez être connecté.");

    // Ensure user has privileges
    if (!await req.connected_user.can_create_repos())
        return error_403(req, res, "Vous n'avez pas les droits pour créer un dépôt.");

    let status = 'hidden';
    // TODO : find a more internationalized way
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

    const name = display_name_to_url(req.body.name);
    if (!name)
        return error_403(req, res, "Ce nom n'est pas valide");

    try {
        console.log(req.body.name, encodeURIComponent(req.body.name), encodeURI(req.body.name))
        const repos = await new Repos({
            name: encodeURIComponent(name),
            owner: req.connected_user.id,
            status: status,
            display_name: encodeURIComponent(req.body.name)
        }).push();
        logger.warn(`${req.log_name} created a new ${status} repos named ${name}`)

        if (repos)
            res.redirect(`/${req.connected_user.name}/${repos.name}`);
    }
    catch (error) {
        logger.error(`${req.log_name} created a new ${status} repos but it failed ! : ${error}`)

    }
});

module.exports = router;