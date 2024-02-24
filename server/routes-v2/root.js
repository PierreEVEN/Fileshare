/***********************************************************************************************/
/*                                           ROOT                                              */
/***********************************************************************************************/

const router = require("express").Router();
const {User} = require("../database/user");
const {error_404, get_common_data} = require("../session_utils");
const {logger} = require("../logger");

/********************** [GLOBAL] **********************/
router.use(async (req, res, next) => {
    // Test auth token
    if (req.headers['content-authtoken']) {
        req.connected_user = await User.from_auth_token(req.headers['content-authtoken'])
    }
    if (req.cookies && req.cookies['authtoken'])
        req.connected_user = await User.from_auth_token(req.cookies['authtoken'])
    req.log_name = req.connected_user ? req.connected_user.name : req.ip;

    logger.info(`[${req.log_name}] : ${req.url}`)

    next();
})
/********************** [GLOBAL] **********************/

router.get('/', async function (req, res) {
    res.render('fileshare', {
        title: 'FileShare',
        common: await get_common_data(req)
    });
});

router.use('/api', require('./api/root'));
router.use('/settings/', require('./settings/root'));

const user_router = require("express").Router();
user_router.use('/:username/', async (req, res, next) => {
    req.display_user = await User.from_name(req.params['username']);
    if (!req.display_user)
        return error_404(req, res);
    next();
});
user_router.use('/:username/', require('./user/root'))
router.use('/', user_router);

module.exports = router;
