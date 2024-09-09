/***********************************************************************************************/
/*                                         UTILS                                               */
/***********************************************************************************************/

const {error_403} = require("../../session_utils");
const {logger} = require("../../logger");
const {HttpResponse} = require("../utils/errors");
const router = require("express").Router();
const dayjs = require('dayjs')

router.get('/server-time/', (req, res) => {
    res.send({"server-time": dayjs().unix()})
});

router.post('/create-repos', async (req, res) => {
    // Ensure user is connected
    if (req.connected_user == null)
        return new HttpResponse(HttpResponse.FORBIDDEN, "You should be connected to create a repository").redirect_error(req, res);

    // Ensure user has privileges
    if (!await req.connected_user.can_create_repos())
        return new HttpResponse(HttpResponse.FORBIDDEN, "You don't have the required permissions to create a repository").redirect_error(req, res);

    let status = 'hidden';
    // TODO : find a more internationalized way
    switch (req.body.type) {
        case 'Invisible':
            status = 'hidden';
            break;
        case 'Privé':
            status = 'private';
            break;
        case 'Publique':
            status = 'public';
            break;
    }

    const name = display_name_to_url(req.body.name);
    if (!name)
        return new HttpResponse(HttpResponse.FORBIDDEN, "The requested repository name is not valid").redirect_error(req, res);

    try {
        const repos = await new Repos({
            name: encodeURIComponent(name),
            owner: req.connected_user.id,
            status: status,
            display_name: encodeURIComponent(req.body.name)
        }).push();
        logger.warn(`${req.log_name} created a new ${status} repos named ${name}`)

        if (repos)
            res.redirect(`/${req.connected_user.name.for_url()}/${repos.name.for_url()}`);
    }
    catch (error) {
        return new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, `Failed to create repository : ${error}`).redirect_error(req, res);
    }
});



router.post("/repos-data", async (req, res) => {
    const data = [];
    for (const repos of req.body) {
        const repo_data = await Repos.from_id(repos);
        if (!repo_data)
            continue;
        if (await ServerPermissions.can_user_view_repos(repo_data, req.connected_user ? req.connected_user.id : undefined)) {
            const owner = await User.from_id(repo_data.owner);
            repo_data.username = owner.name;
            data.push(repo_data);
        }
    }
    return res.send(data)
})

module.exports = router;