let express = require('express');
let router = express.Router();
let db = require("../../database")
const fs = require("fs");
const Repos = require('../../src/database/tables/repos')
const session_utils = require("../../src/session_utils");

/* GET users listing. */
router.get('/', async function (req, res, next) {
    res.render('fileshare/fileshare', {
        title: 'FileShare',
        user: req.session.user,
    });
});

/* GET users listing. */
router.get('/repos/:repos', async function (req, res, next) {
    const found_repos = await Repos.create_access_key(req.params.repos);
    if (!found_repos) {
        // render the error page
        res.status(404);
        return res.render('error', {
            message: "Ce dépot n'existe pas",
            title: "404 - Not found",
            error: req.app.get('env')
        })
    }

    const owner = await found_repos.get_owner();
    if (await found_repos.get_status() === 'private') {
        if (session_utils.require_connection(req, res))
            return;

        if (owner.get_id() !== req.session.user.id) {
            res.status(403);
            return res.render('error', {
                message: "Ce dépot n'est pas accessible'",
                title: "403 - Forbidden",
                error: req.app.get('env')
            })
        }

    }

    res.render('fileshare/repos', {
        title: `FileShare - ${await found_repos.get_name()}`,
        user: req.session.user,
    });
});


const upload = require("./upload");
router.get('/repos/:repos/upload', upload.view)
router.post('/repos/:repos/upload', upload.post_upload);

const signin = require('../account/signin')
router.get('/signin', signin.view);
router.post('/signin', signin.post_signin);

const signup = require('../account/signup')
router.get('/signup', signup.view);
router.post('/signup', signup.post_signup);

const create_repos = require("../fileshare/create-repos")
router.get('/create-repos/', create_repos.view);
router.post('/create-repos/', create_repos.post_create_repos);

router.use('/account/', require("../account/account"));

router.post('/logout', (req, res) => {
    req.session.user = null;
    req.session.last_url = null;
    res.redirect('/fileshare');
});

router.get('/download', async function (request, response) {

    if (!request.query.file) {
        return;
    }


    const connection = await db();
    let file = Object.values(await connection.query('SELECT * FROM Personal.files.js WHERE id = ?', [request.query.file]));
    await connection.end()

    if (file.length > 0) {
        file = file[0]
        const file_path = `./${file.storage_path}`
        if (fs.existsSync(file_path)) {
            response.download(file_path, file.name); // Set disposition and send it.
        }
    }
})

module.exports = router;
