/***********************************************************************************************/
/*                                          AUTH                                               */
/***********************************************************************************************/

const {User} = require("../../database/user");
const {logger} = require("../../logger");
const router = require("express").Router();

router.post("/create-authtoken/", async (req, res) => {
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
        console.assert(false, "NOT IMPLEMENTED YET : handle proper error log");
    }
})

router.post("/delete-authtoken/:authtoken", async (req, res) => {
    const found_user = await User.from_auth_token(req.params['authtoken']);
    if (found_user) {
        logger.info(`User '${found_user.name}' is trying to delete its token`);
        await req.local_user.delete_auth_token(req.params['authtoken']);
        res.sendStatus(200);
    }
    else {
        console.assert(false, "NOT IMPLEMENTED YET : handle proper error log");
    }
})

module.exports = router;