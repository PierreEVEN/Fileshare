/***********************************************************************************************/
/*                                          USER                                               */
/***********************************************************************************************/

const {error_404} = require("../../session_utils");
const {User} = require("../../database/user");
const {Repos} = require("../../database/repos");
const router = require("express").Router();

/********************** [GLOBAL] **********************/
router.use('/', (req, res, next) => {
    if (!req.display_user)
        return error_404(req, res);

    next();
});
/********************** [GLOBAL] **********************/

router.get("/", (req, res) => {
    return error_404(req, res);
})

const repos_router = require("express").Router();
repos_router.use('/:repos/', async (req, res, next) => {
    if (!req.display_user)
        return error_404(req, res);
    req.repos = await Repos.from_name(req.params['repos'], req.display_user);
    if (!req.repos)
        return error_404(req, res);
    next();
});
repos_router.use('/:repos/', require('./repos/root'))
router.use('/', repos_router);


module.exports = router;