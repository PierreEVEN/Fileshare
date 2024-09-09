/***********************************************************************************************/
/*                                           ROOT                                              */
/***********************************************************************************************/

const router = require("express").Router();
const {get_common_data} = require("../session_utils");
const {logger} = require("../logger");
const {HttpResponse} = require("./utils/errors");

/********************** [GLOBAL] **********************/
router.use(async (req, res, next) => {

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
router.use('/administration/', require('./settings/administration'));

const user_router = require("express").Router();
user_router.use('/:username/', async (req, res, next) => {
    req.display_user = await User.from_name(req.params['username']);
    if (!req.display_user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown user").redirect_error(req, res);
    next();
});
user_router.use('/:username/', require('./user/root'))
router.use('/', user_router);

module.exports = router;
