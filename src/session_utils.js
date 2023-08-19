const Users = require("./database/tables/user");
const Repos = require("./database/tables/repos");
const UserRepos = require("./database/tables/user_repos");

function require_connection(req, res) {
    if (!req.session.user) {
        req.session.last_url = req.originalUrl;
        res.redirect('/fileshare/signin');
        return true;
    }
    return false;
}

async function get_user_private_data(user) {
    const repos = []
    for (const user_repos of await UserRepos.find_user(user))
        repos.push(await user_repos.get_repos().public_data())

    return {
        repos: repos,
        id: user.get_id(),
        username: await user.get_username(),
        email: await user.get_email(),
    }
}

module.exports = {require_connection, get_user_private_data}