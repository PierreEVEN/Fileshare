let express = require('express');
let router = express.Router();

router.use('/repos', require('./repos'))
router.use('/account/', require("./account"));

/* GET users listing. */
router.get('/', async function (req, res, next) {

    await session_data(req).select_repos(null);

    res.render('fileshare/fileshare', {
        title: 'FileShare',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
    });
});

const signup = require('./signup')
router.get('/signup', signup.view);
router.post('/signup', signup.post_signup);

const signin = require('./signin')
router.get('/signin', signin.view);
router.post('/signin', signin.post_signin);

router.post('/logout', async (req, res) => {
    await session_data(req).connect_user(null);
    req.session.last_url = null;
    res.redirect('/fileshare');
});

const create_repos = require("../fileshare/create-repos")
const {session_data, public_data} = require("../../src/session_utils");
router.get('/create-repos/', create_repos.view);
router.post('/create-repos/', create_repos.post_create_repos);
router.post('/delete-repos/:repos', create_repos.post_delete_repos);

module.exports = router;
