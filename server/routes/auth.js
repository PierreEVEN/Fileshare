const {session_data, public_data} = require("../session_utils");
const {User} = require("../database/user");
const {logger} = require("../logger");
const router = require('express').Router();

router.post('/gen-token/', async (req, res) => {
    const found_user = await User.from_credentials(req.body.username, req.body.password);
    logger.info(`User '${req.body.username}' is trying to generate a new auth token`);
    if (found_user) {
        const [token, exp_date] = await found_user.gen_auth_token();

        res.send({
            token: token,
            expiration_date: exp_date
        });
        logger.info(`Generated auth token for user '${req.body.username}'`);
    }
    else {
        res.status(401).send(JSON.stringify({
            message: {
                severity: 'error',
                title: 'Erreur de connexion',
                content: 'Identifiants ou mot de passe invalid'
            }
        }))
    }
})

router.get('/signin/', async (req, res) => {
    res.render('fileshare', {
        title: "Connexion",
        force_login: true,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get()
    });
})

router.post('/signin/', async (req, res) => {
    const found_user = await User.from_credentials(req.body.username, req.body.password);
    await session_data(req).connect_user(found_user);

    if (found_user)
        res.redirect(req.session.last_url ?  req.session.last_url : '/');
    else {
        res.status(401).send(JSON.stringify({
            message: {
                severity: 'error',
                title: 'Erreur de connexion',
                content: 'Identifiants ou mot de passe invalid'
            }
        }))
    }
})

router.get('/signup/', async (req, res) => {
    res.render('fileshare', {
        title: "Nouveau compte",
        force_signin: true,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get()
    });
})

router.post('/signup/', async (req, res) => {
    let name = req.body.username;
    let email = req.body.email;
    let password = req.body.password;

    if (name && password && email) {
        if (await User.exists(name, email)) {
            return res.status(401).send(JSON.stringify({
                message: {
                    severity: 'error',
                    title: 'Impossible de créer le compte',
                    content: 'Un utilisateur avec le même nom ou le même mot de passe existe déjà'
                }
            }))
        }

        const new_user = await User.create({
            email: email,
            name: name,
            password: password
        });

        await session_data(req).connect_user(new_user)

        res.redirect(req.session.last_url ?  req.session.last_url : '/');
        req.session.last_url = null;
    } else {
        return res.status(401).send(JSON.stringify({
            message: {
                severity: 'error',
                title: 'Erreur de connexion',
                content: 'Informations manquantes'
            }
        }))
    }
})

router.post('/logout', async (req, res) => {
    await session_data(req).connect_user(null);
    req.session.last_url = null;
    res.redirect('/');
});

module.exports = router