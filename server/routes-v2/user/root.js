/***********************************************************************************************/
/*                                          USER                                               */
/***********************************************************************************************/

const {get_common_data} = require("../../session_utils");
const {Repos} = require("../../database/repos");
const {HttpResponse} = require("../utils/errors");
const perms = require("../../permissions");
const {ServerString} = require("../../server_string");
const router = require("express").Router();

/********************** [GLOBAL] **********************/
router.use('/', (req, res, next) => {
    if (!req.display_user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown user").redirect_error(req, res);
    next();
});
/********************** [GLOBAL] **********************/

router.get("/", async (req, res) => {
    res.render('fileshare', {
        title: 'FileShare',
        common: await get_common_data(req)
    });
})

const repos_router = require("express").Router();
repos_router.use('/:repos/', async (req, res, next) => {
    if (!req.display_user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown user").redirect_error(req, res);
    req.display_repos = await Repos.from_name(ServerString.FromURL(req.params['repos']), req.display_user);
    if (!req.display_repos)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown repository").redirect_error(req, res);

    if (!await perms.can_user_view_repos(req.display_repos, req.connected_user ? req.connected_user.id : null))
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown repository").redirect_error(req, res);

    next();
});
repos_router.use('/:repos/', require('./repos/root'))

router.use('/', repos_router);

module.exports = router;