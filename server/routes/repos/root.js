const {
    session_data,
    public_data,
    error_404,
    require_connection,
    error_403,
    request_username, events
} = require("../../session_utils");
const {Repos} = require("../../database/repos");
const {logger} = require("../../logger");
const perms = require("../../permissions");
const {File} = require("../../database/files");
const path = require("path");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (!req.query.repos)
        return res.redirect('/');
    const repos = await Repos.from_access_key(req.query.repos);

    // This repo does not exist
    if (!repos)
        return error_404(req, res);

    if (!await perms.can_user_view_repos(repos, req['user'] ? req['user'].id : null)) {
        // Redirect to signin page if user is not connected
        if (!req['user'])
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

router.get('/content/', async function (req, res, _) {
    logger.info(`${request_username(req)} fetched content of ${req.repos.access_key}`)
    res.json(await req.repos.get_content());
});

router.get('/infos/', async function (req, res, _) {
    logger.info(`${request_username(req)} fetched informations of ${req.repos.access_key}`)
    res.json(await req.repos);
});

router.post('/update/', async function (req, res, _) {
    if (!await perms.can_user_edit_repos(req.repos, req.user ? req.user.id : null))
        return error_403(req, res, 'Accès non autorisé');

    req.repos.name = req.body.name;
    req.repos.description = req.body.description;
    if (req.repos.status !== req.body.status) {
        if (req.repos.status === 'public' || req.body.status === 'public')
            public_data().mark_dirty();
        req.repos.status = req.body.status;
        await events.on_update_repos(req.repos);
    }
    req.repos.access_key = req.body.access_key;
    req.repos.max_file_size = req.body.max_file_size;
    req.repos.visitor_file_lifetime = req.body.guest_file_lifetime;
    req.repos.allow_visitor_upload = req.body.allow_visitor_upload === 'on';

    req.repos.push();
    logger.warn(`${request_username(req)} updated repos ${req.repos.access_key}`)
    return res.redirect(session_data(req).selected_repos ? `/repos/?repos=${req.repos.access_key}` : '/');
});

router.post('/delete/', async (req, res) => {
    if (require_connection(req, res))
        return;

    if (req.repos.owner !== req.user.id)
        return error_403(req, res);

    await events.on_delete_repos(req.repos);
    logger.warn(`${request_username(req)} deleted repos ${req.repos.access_key}`)
    res.redirect(`/`);
});

router.post('/delete-file/', async (req, res) => {

    const request_path = decodeURI(req.query.path);
    if (!request_path || !req.query.path)
        return error_404(req, res);
    const file = await File.from_path(req.repos.id, request_path)

    if (!file)
        return error_404(req, res);

    if (req.repos.owner !== req.user.id)
        return error_403(req, res);

    logger.warn(`${JSON.stringify(req.user)} deleted file ${file.id}`)

    await file.delete();
    res.sendStatus(200);
});

router.get('/tree/', async function (req, res, _) {
    logger.info(`${request_username(req)} retrieved tree of repos ${req.repos.access_key}`);
    const internal_data = await req.repos.get_tree();

    res.send(internal_data);
});

router.get('/file/', async function (req, res, _) {
    const request_path = decodeURI(req.query.path);
    if (!request_path || !req.query.path)
        return error_404(req, res);

    const file = await File.from_path(req.repos.id, request_path);
    if (!file)
        return error_404(req, res);

    logger.info(`${request_username(req)} downloaded ${file.name}#${file.id}`)
    res.setHeader('Content-Type', `${file.mimetype}`)
    res.setHeader('Content-Timestamp', `${file.timestamp}`)
    res.setHeader('Content-Disposition', 'inline; filename=' + encodeURIComponent(file.name));
    return res.sendFile(path.resolve(await file.storage_path()));
});

router.use('/upload/', require('./upload'));

module.exports = router;