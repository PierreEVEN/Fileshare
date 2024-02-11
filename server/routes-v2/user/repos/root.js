/***********************************************************************************************/
/*                                         REPOS                                               */
/***********************************************************************************************/

const {get_common_data, error_404, require_connection, error_403} = require("../../../session_utils");
const {Repos} = require("../../../database/repos");
const perms = require("../../../permissions");
const router = require("express").Router();

/********************** [GLOBAL] **********************/
router.use('/', async (req, res, next) => {
    if (!req.repos)
        return error_404(req, res);

    if (!await perms.can_user_view_repos(req.repos, req.local_user ? req.local_user.id : null)) {
        // Redirect to signin page if user is not connected
        if (!req.local_user)
            return require_connection(req, res);

        // This user is not allowed to access this repos
        return error_403(req, res);
    }

    next();
});
/********************** [GLOBAL] **********************/


router.get("/", async (req, res) => {
    res.render('repos', {
        title: `FileShare - ${req.repos.name}`,
        common: await get_common_data(req),
    });
})


module.exports = router;