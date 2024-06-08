/***********************************************************************************************/
/*                                          AUTH                                               */
/***********************************************************************************************/

const {User} = require("../../database/user");
const {logger} = require("../../logger");
const {session_data} = require("../../session_utils");
const router = require("express").Router();

router.post("/create-user/", async (req, res) => {
    let name = encodeURIComponent(req.body.username);
    let email = encodeURIComponent(req.body.email);
    let password = encodeURIComponent(req.body.password);

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

        const [token, exp_date] = await new_user.gen_auth_token();

        res.send({
            token: token,
            expiration_date: exp_date
        });
        logger.info(`User '${req.body.username} created a new account'`);
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

router.post("/create-authtoken/", async (req, res) => {
    const found_user = await User.from_credentials(encodeURIComponent(req.body.username), encodeURIComponent(req.body.password));
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
        res.send({
            message: {
                severity: 'error',
                title: 'Ce compte n\'existe pas',
                content: 'Un utilisateur avec le même nom ou le même mot de passe existe déjà'
            }
        })
        console.assert(false, "NOT IMPLEMENTED YET : handle proper error log");
    }
})

router.post("/delete-authtoken/:authtoken", async (req, res) => {
    const found_user = await User.from_auth_token(req.params['authtoken']);
    if (found_user) {
        logger.info(`User '${found_user.name}' is trying to delete its token`);
        await req.connected_user.delete_auth_token(req.params['authtoken']);
        res.sendStatus(200);
    }
    else {
        console.assert(false, "NOT IMPLEMENTED YET : handle proper error log");
    }
})

module.exports = router;