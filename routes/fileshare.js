let express = require('express');
let router = express.Router();
const {session_data, public_data} = require("../src/session_utils");

/* GET users listing. */
router.get('/', async function (req, res, next) {
    await session_data(req).select_repos(null);
    res.render('fileshare', {
        title: 'FileShare',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get()
    });
});

router.use('/', require('./auth'));
router.use('/repos/', require('./repos'));
router.use('/file/', require('./file'));
router.use('/create-repos/', require('./create-repos'));

module.exports = router;
