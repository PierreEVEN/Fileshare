let express = require('express');
let router = express.Router();
let db = require("../../database")
const formidable = require("formidable");
const crypto = require("crypto");
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

    res.render('fileshare/fileshare', {
        title: 'FileShare',
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

router.use('/create-repos/', require("../fileshare/create-repos"));
router.use('/forgot-password/', require("../account/forgot-password"));
router.use('/account/', require("../account/account"));

router.post('/create-repos', async function (request, response) {
    // Capture the input fields
    let name = request.body.name;
    let type = request.body.type;

    // Ensure the input fields exists and are not empty
    if (name && type) {

        const connection = await db();

        if (Object.entries(await connection.query('SELECT * FROM Personal.repos.js WHERE name = ?', [name])).length !== 0) {
            response.render('fileshare/create-repos.js', {
                title: 'Nouveau dépot - Nom déjà pris',
                error: 'Ce nom est déjà pris'
            });
            await connection.end();
            return;
        }

        let status = 'hidden'
        switch (type) {
            case 'invisible':
                status = 'hidden';
                break;
            case 'Privé':
                status = 'private';
                break;
            case 'Publique':
                status = 'public';
                break;
        }

        const res = await connection.query('INSERT INTO Personal.repos.js (name, owner, status, access_key) VALUES (?, ?, ?, ?)', [name, request.session.user.id, status, crypto.randomBytes(16).toString("hex")]);
        await connection.query('INSERT INTO Personal.accountrepos (owner, repos.js) VALUES (?, ?)', [request.session.user.id, res.insertId]);

        // If the account exists
        if (Object.entries(res).length > 0) {
            request.session.user.my_repos.push(Object.values(await connection.query('SELECT * FROM Personal.repos.js WHERE id = ?', [res.insertId]))[0])
            response.redirect('/fileshare');
        }
        await connection.end();
    } else {
        response.render('account/signup', {
            title: 'Nouveau compte - Missing fields',
            error: 'Veuillez remplir tous les champs requis'
        });
    }
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
