const permissions = require("../../../../permissions");
const {HttpResponse} = require("../../../utils/errors");
const {Item} = require("../../../../database/item");
const perms = require("../../../../permissions");
const {ServerPermissions} = require("../../../../permissions");

const router = require("express").Router();

router.get("/upload/", async (req, res) => {
    if (req.connected_user && req.display_repos)
        if (await ServerPermissions.can_user_upload_to_repos(req.display_repos, req.connected_user.id))
            return res.sendStatus(HttpResponse.OK);
    return new HttpResponse(HttpResponse.UNAUTHORIZED).redirect_error(req, res);
});

router.get("/edit/", async (req, res) => {
    if (req.connected_user && req.display_repos)
        if (await ServerPermissions.can_user_configure_repos(req.display_repos, req.connected_user.id))
            return res.sendStatus(200)
    res.sendStatus(204);
})

router.get("/upload/:id", async (req, res) => {
    // Search the requested file or dir
    if (Number.isNaN(Number(req.params['id'])))
        return new HttpResponse(HttpResponse.BAD_REQUEST, "The provided object id is not valid").redirect_error(req, res);

    const item = await Item.from_id(req.params['id']);
    if (item && req.connected_user && req.display_repos)
        if (await ServerPermissions.can_user_upload_to_directory(item, req.connected_user.id))
            return res.sendStatus(HttpResponse.OK);
    return new HttpResponse(HttpResponse.UNAUTHORIZED).redirect_error(req, res);
})

router.get("/edit/:id", async (req, res) => {
    // Search the requested file or dir
    if (Number.isNaN(Number(req.params['id'])))
        return new HttpResponse(HttpResponse.BAD_REQUEST, "The provided object id is not valid").redirect_error(req, res);

    const item = await Item.from_id(req.params['id']);
    if (item && req.connected_user && req.display_repos)
        if (await ServerPermissions.can_user_edit_item(item, req.connected_user.id))
            return res.sendStatus(HttpResponse.OK);
    return new HttpResponse(HttpResponse.UNAUTHORIZED).redirect_error(req, res);
})


module.exports = router;