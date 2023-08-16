let express = require('express');
let router = express.Router();
let db = require("../../database")
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const crypto = require('crypto');

/* GET users listing. */
router.get('/', function (req, res, next) {
    res.render('fileshare/fileshare', {
        title: 'FileShare',
        my_files: ['AMN - A fond le jazz 2023', 'AMN - A fond le jazz 2024', 'AMN - Bonjour le jazz 2023']
    });
});

router.use('/signin/', require("../account/signin"));
router.use('/signup/', require("../account/signup"));
router.use('/forgot-password/', require("../account/forgot-password"));

router.post('/forgot-password', async function (request, response) {
    // Capture the input fields
    let email = request.body.email;
    // Ensure the input fields exists and are not empty
    if (email) {
        const id = crypto.randomBytes(20).toString('hex');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: 'no-reply@gmail.com',
            to: email,
            subject: 'FileShare - Réinitialisation du mot de passe',
            text: `Cliquez sur le lien suivant pour réinitialiser votre mot de passe : http://${process.env.SERVER_ADDRESS}/fileshare/password-reset/${id}`
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log("Failed to send email : ", error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });



        const connection = await db()
        const res = await connection.query('SELECT * FROM Personal.accounts WHERE email = ?', [email]);

        if (Object.entries(res).length === 0) {
            response.render('account/forgot-password', {
                title: 'Mot de passe oublié - Compte inexistant',
                error: 'Cet e-mail n\'est associé avec aucun compte'
            });
            await connection.end();
            return;
        }

        // If the account exists
        if (found) {
            // Authenticate the user
            request.session.loggedin = true;
            request.session.username = username;
            // Redirect to home page
            response.redirect('/fileshare');
        } else {
            response.render('account/forgot-password', {
                title: 'Mot de passe oublié - Champs incomplets',
                error: 'Veuillez spécifier votre e-mail'
            });
        }
        await connection.end();
    } else {
        response.render('account/forgot-password', {
            title: 'Connexion - Pas d\'identifiants',
            error: 'Veuillez fournir un identifiant et un mot de passe valide'
        });
    }
});

router.post('/signin', async function (request, response) {
    // Capture the input fields
    let username = request.body.username;
    let password = request.body.password;
    // Ensure the input fields exists and are not empty
    if (username && password) {

        const connection = await db()
        const res = await connection.query('SELECT * FROM Personal.accounts WHERE username = ? OR email = ?', [username, username]);
        let found = false;
        for (let user of res) {
            if (bcrypt.compare(user.password_hash, password)) {
                found = true;
                break;
            }
        }

        // If the account exists
        if (found) {
            // Authenticate the user
            request.session.loggedin = true;
            request.session.username = username;
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

        // If the account exists
        if (Object.entries(res).length > 0) {
            // Authenticate the user
            request.session.loggedin = true;
            request.session.username = username;
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

module.exports = router;
