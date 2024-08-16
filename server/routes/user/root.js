/***********************************************************************************************/
/*                                          USER                                               */
/***********************************************************************************************/

const {get_common_data} = require("../../session_utils");
const {Repos} = require("../../database/repos");
const {HttpResponse} = require("../utils/errors");
const {ServerString} = require("../../server_string");
const {ServerPermissions} = require("../../permissions");
const db = require("../../database/tools/database");
const {send_mail} = require("../utils/mailer");
const router = require("express").Router();

/********************** [GLOBAL] **********************/
router.use('/', (req, res, next) => {
    if (!req.display_user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown user").redirect_error(req, res);
    next();
});
/********************** [GLOBAL] **********************/

router.get("/", async (req, res) => {
    res.render('fileshare', {
        title: 'FileShare',
        common: await get_common_data(req)
    });
})

router.get("/settings/", async (req, res) => {
    if (!req.connected_user)
        return new HttpResponse(HttpResponse.UNAUTHORIZED, "Not connected").redirect_error(req, res);
    res.render('user_settings', {
        title: 'Paramètres utilisateur',
        common: await get_common_data(req)
    });
})

const EmailsInResetState = {

}
router.post('/reset-password/', async (req, res) => {
    if (!req.body.email)
        return new HttpResponse(HttpResponse.BAD_REQUEST).redirect_error(req, res);
    await send_mail(
        new ServerString(req.body.email).plain(),
        'Réinitialisation du mot de passe fileshare',
        `
<p>Bonjour,
<br>
Vous avez demandé la réinitialisation de votre mot de passe fileshare.
Si c'est le cas, veuillez cliquer <a href="${req.protocol}://${req.get('host')}/reset-password/${'blblbl'}/">ici</a> pour procéder à la réinitialisation.</p>

<p>Cordialement.</p>  
    `);
    return new HttpResponse(HttpResponse.OK).redirect_error(req, res);
})


router.get('/user-token-list/', async (req, res) => {
    if (!req.connected_user)
        return new HttpResponse(HttpResponse.UNAUTHORIZED, "Not connected").redirect_error(req, res);
    const tokens = await db.single().rows(`SELECT expdate, device, token FROM fileshare.authtoken WHERE owner = $1`, [req.connected_user.id]);
    return res.send(tokens);
})

const repos_router = require("express").Router();
repos_router.use('/:repos/', async (req, res, next) => {
    if (!req.display_user)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown user").redirect_error(req, res);
    req.display_repos = await Repos.from_name(ServerString.FromURL(req.params['repos']), req.display_user);
    if (!req.display_repos)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown repository").redirect_error(req, res);

    if (!await ServerPermissions.can_user_view_repos(req.display_repos, req.connected_user ? req.connected_user.id : null)) {
        // Ask the user to connect
        if (!req.connected_user) {
            return res.render('fileshare', {
                title: `${this.status_code} - ${HttpResponse.error_code_to_string(this.status_code)}`,
                common: await get_common_data(req),
                force_login: true,
            })
        }
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown repository").redirect_error(req, res);
    }

    next();
});
repos_router.use('/:repos/', require('./repos/root'))

router.use('/', repos_router);

module.exports = router;