const {
    session_data,
    public_data,
    error_404,
    require_connection,
    error_403,
    request_username
} = require("../../src/session_utils");
const {Repos} = require("../../src/database/repos");
const {logger} = require("../../src/logger");
const perms = require("../../src/permissions");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (!req.query.repos)
        return res.redirect('/');

    const repos = await Repos.from_access_key(req.query.repos);

    // This repo does not exist
    if (!repos)
        return error_404(req, res);

    if (!await perms.can_user_view_repos(repos, req.user ? req.user.id : null)) {
        // Redirect to signin page if user is not connected
        if (!req.user)
            return require_connection(req, res);

        // This user is not allowed to access this repos
        return error_403(req, res);
    }

    await session_data(req).select_repos(repos);
    req.repos = repos;
    next();
})
/* ###################################### CREATE ROUTER ###################################### */

router.get('/', async (req, res) => {
    res.render('repos', {
        title: `FileShare - ${req.repos.name}`,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get()
    });
})

router.get('/content/', async function (req, res, next) {
    logger.info(`${request_username(req)} fetched content of ${req.repos.access_key}`)
    res.json(await req.repos.get_content());
});

router.post('/delete/', async (req, res) => {
    if (require_connection(req, res))
        return;

    if (!req.repos.owner === req.user.id)
        return error_403(req, res);

    await events.on_delete_repos(req.repos);
    logger.warn(`${request_username(req)} deleted repos ${req.repos.access_key}`)
    res.redirect(`/`);
});

router.use('/upload/', require('./upload'));

module.exports = router;