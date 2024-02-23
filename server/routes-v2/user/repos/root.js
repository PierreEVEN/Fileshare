/***********************************************************************************************/
/*                                         REPOS                                               */
/***********************************************************************************************/

const {get_common_data, error_404, require_connection, error_403} = require("../../../session_utils");
const {Repos} = require("../../../database/repos");
const perms = require("../../../permissions");
const permissions = require("../../../permissions");
const router = require("express").Router();

/********************** [GLOBAL] **********************/
router.use('/', async (req, res, next) => {
    if (!req.display_repos)
        return error_404(req, res);

    if (!await perms.can_user_view_repos(req.display_repos, req.connected_user ? req.connected_user.id : null)) {
        // Redirect to signin page if user is not connected
        if (!req.connected_user)
            return require_connection(req, res);

        // This user is not allowed to access this repos
        return error_403(req, res);
    }

    next();
});
/********************** [GLOBAL] **********************/


router.get("/", async (req, res) => {
    res.render('repos', {
        title: `FileShare - ${req.display_repos.name}`,
        common: await get_common_data(req),
    });
})

router.get("/tree", async (req, res) => {
    res.render('repos', {
        title: `FileShare - ${req.display_repos.name}`,
        common: await get_common_data(req),
    });
})

router.get("/data", async (req, res) => {

    res.send(await req.display_repos.get_tree());

})

router.get("/can-upload", async (req, res) => {
    if (req.connected_user && req.display_repos) {
        if (await permissions.can_user_upload_to_repos(await Repos.from_id(req.display_repos.id), req.connected_user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

router.get("/can-edit", async (req, res) => {
    if (req.connected_user && req.display_repos) {
        if (await permissions.can_user_edit_repos(await Repos.from_id(req.display_repos.id), req.connected_user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

module.exports = router;