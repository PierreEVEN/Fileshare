const {Repos} = require("./database/repos");
const {logger} = require("./logger");

function require_connection(req, res) {
    if (!req.connected_user) {
        if (req.method === 'POST' || req.headers["no-redirect"])
            res.status(403).send('Connection required');
        else
            res.redirect('/TODOCONNECTIONPAGE');
        return true;
    }
    return false;
}

async function error_404(req, res, custom_error = null) {
    logger.error(`404 Not found : ${req.originalUrl} (${req.connected_user ?  req.connected_user.name : req.ip})`)
    res.status(404).render('error', {
        title: "404 - Not found",
        common: await get_common_data(req),
        message: `404 - ${custom_error ? custom_error : 'Cette page n\'existe pas'}`
    })
}

async function error_403(req, res, custom_error = null) {
    res.status(403).render('error', {
        title: "403 - Forbidden",
        common: await get_common_data(req),
        message: `403 - ${custom_error ? custom_error : 'Cette page n\'est pas accessible'}`
    })
}

async function get_common_data(req) {
    if (req.display_repos)
        await req.display_repos.client_ready()
    const data = {};
    data.tracked_repos = [];
    data.repos_list = [];
    data.user_repos = [];
    data.selected_repos = req.display_repos;

    data.PAGE_CONTEXT = {
        connected_user: req.connected_user,
        display_user: req.display_user,
        display_repos: req.display_repos
    }

    if (req.connected_user) {
        for (const repos of await Repos.from_owner(req.connected_user.id)) {
            data.user_repos.push(await repos.client_ready());
        }
    }

    return data;
}

module.exports = {
    require_connection,
    error_404,
    error_403,
    get_common_data
}