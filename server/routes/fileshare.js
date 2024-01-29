let express = require('express');
let router = express.Router();
const {session_data, public_data} = require("../session_utils");


router.use((req, res, next) => {
    req.user = session_data(req).connected_user;
    res.redirect_to_current_repos = async () => {
        if (session_data(req).selected_repos)
            return res.redirect(`/repos/?repos=${await session_data(req).selected_repos.access_key}`);
        else
            return res.redirect(`/`);
    }
    next();
})

/* GET users listing. */
router.get('/', async function (req, res, _) {
    await session_data(req).select_repos(null);
    res.render('fileshare', {
        title: 'FileShare',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get()
    });
});

router.get('/time-epoch/', (req, res) => {
    res.send({"time_since_epoch": new Date().getTime()})
});
router.use('/auth/', require('./auth'));
router.use('/repos/', require('./repos/root'));
router.use('/file/', require('./file/root'));
router.use('/directory/', require('./directory/root'));
router.use('/create-repos/', require('./create-repos'));
router.use('/archive/', require('./archive'));
router.use('/permissions', require('./permissions'))
module.exports = router;
