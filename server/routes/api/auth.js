/***********************************************************************************************/
/*                                          AUTH                                               */
/***********************************************************************************************/

const {User} = require("../../database/user");
const {logger} = require("../../logger");
const {ServerString} = require("../../server_string");
const {HttpResponse} = require("../utils/errors");
const {gen_uhash} = require("../../database/tools/uid_generator");
const {send_mail} = require("../utils/mailer");
const {get_common_data} = require("../../session_utils");
const router = require("express").Router();

router.post("/create-user/", async (req, res) => {
    let name = new ServerString(req.body.username);
    let email = new ServerString(req.body.email);
    let device = new ServerString(req.body.device);
    let password = req.body.password;

    if (name && password && email) {
        if (await User.exists(name, email)) {
            return await new HttpResponse(HttpResponse.UNAUTHORIZED, "An user with this same name or email already exists!").redirect_error(req, res);
        }
        await User.create({
            name: name.encoded(),
            email: email.encoded(),
            password: password,
        })

        const found_user = await User.from_credentials(name, password);
        logger.info(`User '${name.plain()}' is trying to generate a new auth token`);
        if (found_user) {
            const [token, exp_date] = await found_user.gen_auth_token(device);
            res.send({
                token: token,
                expiration_date: exp_date
            });
            logger.info(`User '${name.plain()} created a new account'`);
        }
        else {
            return await new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, "Failed to find newly created user!").redirect_error(req, res);
        }
    } else {
        return await new HttpResponse(HttpResponse.UNAUTHORIZED, "Missing information").redirect_error(req, res);
    }
})

router.post("/create-authtoken/", async (req, res) => {
    const found_user = await User.from_credentials(new ServerString(req.body.username), req.body.password);
    logger.info(`User '${new ServerString(req.body.username).plain()}' is trying to generate a new auth token`);
    if (found_user) {
        const [token, exp_date] = await found_user.gen_auth_token(new ServerString(req.body.device));

        res.send({
            token: token,
            expiration_date: exp_date
        });
        logger.info(`Generated auth token for user '${req.body.username}'`);
    }
    else {
        return await new HttpResponse(HttpResponse.UNAUTHORIZED, "There is no known user using those credentials").redirect_error(req, res);
    }
})

router.post("/delete-authtoken/:authtoken", async (req, res) => {
    const found_user = await User.from_auth_token(req.params['authtoken']);
    if (found_user && req.connected_user) {
        logger.info(`User '${found_user.name}' is trying to delete its token`);
        await req.connected_user.delete_auth_token(req.params['authtoken']);
        res.sendStatus(HttpResponse.OK);
    }
    else {
        return new HttpResponse(HttpResponse.NOT_FOUND, "User not found").redirect_error(req, res);
    }
})

const EMAILS_IN_RESET_STATE = {
    email_map: new Map(),
    tokens: new Map()
};

router.post('/reset-password/', async (req, res) => {
    if (!req.body.email)
        return new HttpResponse(HttpResponse.BAD_REQUEST).redirect_error(req, res);

    const email = new ServerString(req.body.email).encoded();
    let user = await User.from_email(email);
    if (!user)
        user = await User.from_name(email);
    if (!user)
        return new HttpResponse(HttpResponse.NOT_FOUND, `L'utilisateur ${new ServerString(req.body.email).plain()} n'existe pas`).redirect_error(req, res);


    const reset_token = await gen_uhash((id) => EMAILS_IN_RESET_STATE.tokens.has(id));
    EMAILS_IN_RESET_STATE.tokens.set(reset_token, user.email.encoded());
    EMAILS_IN_RESET_STATE.email_map.set(user.email.encoded(), reset_token);

    await send_mail(
        user.email.plain(),
        'Réinitialisation du mot de passe fileshare',
        `
<p>Bonjour,
<br>
Vous avez demandé la réinitialisation de votre mot de passe fileshare.
Si c'est le cas, veuillez cliquer <a href="${req.protocol}://${req.get('host')}/api/reset-password/${reset_token}/">ici</a> pour procéder à la réinitialisation.</p>

<p>Cordialement.</p>  
    `);
    return new HttpResponse(HttpResponse.OK).redirect_error(req, res);
})

router.get('/reset-password/:token/', async (req, res) => {
    if (!EMAILS_IN_RESET_STATE.tokens.has(req.params.token)) {
        return res.render('error', {
            title: 'Not Found',
            common: await get_common_data(req)
        });
    }

    return res.render('fileshare', {
        title: 'Réinitialisation du mot de passe',
        common: await get_common_data(req),
        password_reset_token: req.params.token,
    });
})

router.post('/reset-password/:token/', async (req, res) => {
    if (!EMAILS_IN_RESET_STATE.tokens.has(req.params.token)) {
        return res.render('error', {
            title: 'Not Found',
            common: await get_common_data(req)
        });
    }

    const email = EMAILS_IN_RESET_STATE.tokens.get(req.params.token);
    const user = await User.from_email(email);

    if (!user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "User not found").redirect_error(req, res);

    await user.set_password(req.body.password)

    EMAILS_IN_RESET_STATE.tokens.delete(req.params.token);
    EMAILS_IN_RESET_STATE.email_map.delete(email);

    return new HttpResponse(HttpResponse.OK, "Mot de passe réinitialisé avec succès !").redirect_error(req, res);
})

module.exports = router;