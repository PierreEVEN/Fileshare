let express = require('express');
let router = express.Router();
let db = require("../../database")
const bcrypt = require("bcrypt");
const crypto = require("crypto");

/* GET users listing. */
router.get('/', async function (req, res, next) {

    if (req.query.repos) {
        const connection = await db()
        let repos = await connection.query('SELECT * FROM Personal.repos WHERE access_key = ? AND (NOT status = \'private\' OR id IN (SELECT repos FROM accountrepos WHERE owner = ?))', [req.query.repos, req.session.user ? req.session.user.id : -1]);

        if (Object.values(repos).length > 0) {
            repos = repos[0]
        }

        if (repos) {
            repos.content = await connection.query('SELECT * FROM Personal.storage WHERE repos = ?', [repos.id]);
        }

        console.log(repos)
        repos.by_author = () => {
            repos.content.sort((a, b) => {
                return a.owner - b.owner
            })

            console.log("Content : ", repos.content)


            return Object.values(repos.content)
        }

        await connection.end()

        res.render('fileshare/fileshare', {
            title: 'FileShare',
            user: req.session.user,
            repos: repos
        });
    }
    else {
        res.render('fileshare/fileshare', {
            title: 'FileShare',
            user: req.session.user
        });
    }
});

router.use('/upload/', require("./upload"));
router.use('/create-repos/', require("../fileshare/create-repos"));
router.use('/signin/', require("../account/signin"));
router.use('/signup/', require("../account/signup"));
router.use('/forgot-password/', require("../account/forgot-password"));
router.use('/account/', require("../account/account"));

async function signin(user, connection, request) {
    let repos = Object.values(await connection.query('SELECT * FROM Personal.repos WHERE id IN (SELECT repos FROM Personal.accountrepos WHERE owner = ?)', [user.id]));
    // Authenticate the user
    request.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        my_repos: repos
    };
}

router.post('/signin', async function (request, response) {
    // Capture the input fields
    let username = request.body.username;
    let password = request.body.password;
    // Ensure the input fields exists and are not empty
    if (username && password) {

        const connection = await db()
        const res = await connection.query('SELECT * FROM Personal.accounts WHERE username = ? OR email = ?', [username, username]);
        let found_user = null;
        for (let user of res) {
            if (bcrypt.compare(user.password_hash, password)) {
                found_user = user;
                break;
            }
        }

        // If the account exists
        if (found_user) {
            await signin(found_user, connection, request);
            // Redirect to home page
            response.redirect('/fileshare');
        } else {
            response.render('account/signin', {
                title: 'Connexion - Mauvais identifiants',
                error: 'Identifiants ou mot de passe invalide'
            });
        }
        await connection.end();
    } else {
        response.render('account/signin', {
            title: 'Connexion - Pas d\'identifiants',
            error: 'Veuillez fournir un identifiant et un mot de passe valide'
        });
    }
});

router.post('/signup', async function (request, response) {
    // Capture the input fields
    let username = request.body.username;
    let email = request.body.email;
    let password = await bcrypt.hash(request.body.password, 10);

    // Ensure the input fields exists and are not empty
    if (username && password && email) {

        const connection = await db();

        if (Object.entries(await connection.query('SELECT * FROM Personal.accounts WHERE username = ?', [username])).length !== 0) {
            response.render('account/signup', {
                title: 'Connexion - Utilisateur existe',
                error: 'Ce nom est déjà pris'
            });
            await connection.end();
            return;
        }

        if (Object.entries(await connection.query('SELECT * FROM Personal.accounts WHERE email = ?', [email])).length !== 0) {
            response.render('account/signup', {
                title: 'Connexion - Email existe',
                error: 'Un compte utilisant cet e-mail existe déjà'
            });
            await connection.end();
            return;
        }

        const res = await connection.query('INSERT INTO Personal.accounts (username, password_hash, email) VALUES (?, ?, ?)', [username, password, email]);
        let found_user = Object.values(await connection.query('SELECT * FROM Personal.accounts WHERE id = ?', [res.insertId]));
        // If the account exists
        if (found_user.length > 0) {
            await signin(found_user[0], connection, request);
            // Redirect to home page
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

router.post('/create-repos', async function (request, response) {
    // Capture the input fields
    let name = request.body.name;
    let type = request.body.type;

    // Ensure the input fields exists and are not empty
    if (name && type) {

        const connection = await db();

        if (Object.entries(await connection.query('SELECT * FROM Personal.repos WHERE name = ?', [name])).length !== 0) {
            response.render('fileshare/create-repos', {
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

        const res = await connection.query('INSERT INTO Personal.repos (name, owner, status, access_key) VALUES (?, ?, ?, ?)', [name, request.session.user.id, status, crypto.randomBytes(16).toString("hex")]);
        await connection.query('INSERT INTO Personal.accountrepos (owner, repos) VALUES (?, ?)', [request.session.user.id, res.insertId]);

        // If the account exists
        if (Object.entries(res).length > 0) {
            request.session.user.my_repos.push(Object.values(await connection.query('SELECT * FROM Personal.repos WHERE id = ?', [res.insertId]))[0])
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

router.post('/upload', async function (request, response) {
    // Capture the input fields
    let file = request.body.file;
    console.log(file);
    response.redirect('/fileshare');
});

module.exports = router;
