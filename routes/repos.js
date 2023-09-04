const {session_data, public_data, error_404, require_connection, error_403} = require("../src/session_utils");
const Repos = require("../src/database/tables/repos");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (!req.query.repos)
        res.redirect('/');

    const repos = await Repos.find_access_key(req.query.repos);

    // This repos does not exist
    if (!repos)
        return error_404(req, res);

    if (!await repos.can_user_read_repos(session_data(req).connected_user)) {
        // Redirect to signin page if user is not connected
        if (!session_data(req).connected_user)
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
        title: `FileShare - ${await req.repos.get_name()}`,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get()
    });
})
router.get('/content/', async function (req, res, next) {
    res.json(await req.repos.public_data(true));
});

router.use('/archive/', require('./repos/archive'));
router.use('/upload/', require('./repos/upload'));
router.use('/delete/', require('./repos/delete'));
router.use('/file/:file/', require('./file'));

module.exports = router;