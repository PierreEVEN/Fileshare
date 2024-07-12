/***********************************************************************************************/
/*                                          AUTH                                               */
/***********************************************************************************************/

const {User} = require("../../database/user");
const {logger} = require("../../logger");
const {ServerString} = require("../../server_string");
const {HttpResponse} = require("../utils/errors");
const router = require("express").Router();

router.post("/create-user/", async (req, res) => {
    let name = new ServerString(req.body.username);
    let email = new ServerString(req.body.email);
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
            const [token, exp_date] = await found_user.gen_auth_token();
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
        const [token, exp_date] = await found_user.gen_auth_token();

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
    if (found_user) {
        logger.info(`User '${found_user.name}' is trying to delete its token`);
        await req.connected_user.delete_auth_token(req.params['authtoken']);
        res.sendStatus(HttpResponse.OK);
    }
    else {
        console.assert(false, "NOT IMPLEMENTED YET : handle proper error log");
    }
})

module.exports = router;