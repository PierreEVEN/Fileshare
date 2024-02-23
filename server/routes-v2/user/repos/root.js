/***********************************************************************************************/
/*                                         REPOS                                               */
/***********************************************************************************************/

const {get_common_data, error_404, require_connection, error_403, request_username} = require("../../../session_utils");
const {Repos} = require("../../../database/repos");
const perms = require("../../../permissions");
const {logger} = require("../../../logger");
const permissions = require("../../../permissions");
const {Directories} = require("../../../database/directories");
const {File} = require("../../../database/files");
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

router.get("/data/", async (req, res) => {
    logger.info(`${request_username(req)} retrieved tree of repos ${req.repos.name}`);
    res.send(await req.repos.get_tree());
})


router.get('/upload-to-repos', async (req, res) => {
    if (req.user && req.query.repos) {
        if (await permissions.can_user_upload_to_repos(await Repos.from_id(req.query.repos), req.user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

router.get('/edit-repos', async (req, res) => {
    if (req.user && req.query.repos) {
        if (await permissions.can_user_edit_repos(await Repos.from_id(req.query.repos), req.user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

router.get('/edit-directory', async (req, res) => {
    if (req.user && req.query.directory) {
        if (await permissions.can_user_edit_directory(await Directories.from_id(req.query.directory), req.user.id))
            return res.sendStatus(200);
    }
    res.sendStatus(204);
})

router.get('/upload-to-directory', async (req, res) => {
    if (req.user && req.query.directory) {
        if (await permissions.can_user_upload_to_directory(await Directories.from_id(req.query.directory), req.user.id))
            return res.sendStatus(200);
    }
    res.sendStatus(204);
})

router.get('/edit-file', async (req, res) => {
    if (req.user && req.query.file) {
        const file = await File.from_id(req.query.file)
        if (!file)
            return res.sendStatus(204);

        if (file.owner === req.user.id)
            return res.sendStatus(200);

        if (file['directory']) {
            if (await permissions.can_user_edit_directory(await Directories.from_id(file.directory), req.user.id))
                return res.sendStatus(200);
        }
        if (await permissions.can_user_edit_repos(await Repos.from_id(file.repos), req.user.id))
            return res.sendStatus(200);
    }
    res.sendStatus(204);
})


module.exports = router;