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
    const my_repos = []

    for (const found_repos of await Repos.find_user(user))
        my_repos.push(await found_repos.public_data())

    const tracked_repos = []
    for (const user_repos of await UserRepos.find_user(user))
        tracked_repos.push(await user_repos.get_repos().public_data())


    return {
        my_repos: my_repos,
        tracked_repos: tracked_repos,
        public_repos: [],
        id: user.get_id(),
        username: await user.get_username(),
        email: await user.get_email(),
    }
}

async function get_available_repos() {


    const my_repos = []
    const tracked_repos = []

    return {
        my_repos: my_repos,
        tracked_repos: tracked_repos,
        public_repos: [],
    }
}

function error_404(req, res, custom_error = null) {
    res.status(404);
    res.render('error', {
        title: "404 - Not found",
        user: req.session.user,
        message: `404 - ${custom_error ? custom_error : 'Cette page n\'existe pas'}`
    })
}

function error_403(req, res, custom_error = null) {
    res.status(403);
    res.render('error', {
        title: "404 - Forbidden",
        user: req.session.user,
        message: `403 - ${custom_error ? custom_error : 'Cette page n\'est pas accessible'}`
    })
}

const available_sessions = {}

class SessionData {
    constructor(id) {
        this.id = id;
        this.connected_user = null;
        this.last_data = null;
    }

    async connect_user(user_id = null) {
        if (user_id)
            this.connected_user = await Users.find(user_id.get_id());
        else
            this.connected_user = null;

        this.last_data = null;

        return this;
    }

    async client_data() {
        if (!this.last_data) {

            const user_repos = []

            if (this.connected_user) {
                for (const repos of await Repos.find_user(this.connected_user)) {
                    user_repos.push(await repos.public_data(false));
                }
            }

            this.last_data = {
                user: this.connected_user ? {
                    id: this.connected_user.get_id(),
                    username: await this.connected_user.get_username(),
                    role: await this.connected_user.get_role(),
                    repos_edit_rights: await this.connected_user.can_edit_repos(),
                    repos: user_repos,
                } : null,

                tracked_repos: [],
                selected_repos: this.selected_repos ? await this.selected_repos.public_data(true) : null,
            }
        }
        return this.last_data;
    }

    /**
     * @param repos {Repos}
     */
    select_repos(repos = null) {
        if (!repos && this.selected_repos) {
            this.selected_repos = null;
            this.mark_dirty();
        }

        if (repos && !this.selected_repos) {
            this.selected_repos = repos;
            this.mark_dirty();
        }

        if (repos && this.selected_repos && repos.get_id() !== this.selected_repos.get_id()) {
            this.selected_repos = repos;
            this.mark_dirty();
        }
    }

    mark_dirty() {
        this.last_data = null;
    }
}

events = {
    on_delete_repos : (repos) => {
        for (const session of Object.values(available_sessions)) {
            for (const user_repos of session.connected_user.my_repos)
                if (user_repos.id === repos.get_id())
                    session.mark_dirty();

            for (const user_repos of session.public_repos.tracked_repos)
                if (user_repos.id === repos.get_id())
                    session.mark_dirty();
        }

        public_data().mark_dirty();

        repos.delete();
        console.error("supprimer les repos de l'user + ceux des autres connectés et aussi si c'es tpublique")
    }
}

class PublicData {

    constructor() {
        this.dirty = true;
    }

    mark_dirty() {
        this.dirty = true;
    }

    get_repos_list() {
        return [{name: 'test', access_key:'none', id:'-1'}]
    }
}

/**
 * @returns {SessionData}
 */
function session_data(req) {
    const session_id = req.sessionID
    if (available_sessions[session_id])
        return available_sessions[session_id];
    else {
        const new_session = new SessionData(session_id);
        available_sessions[session_id] = new_session;
        return new_session;
    }
}

const _public_data = new PublicData();

async function public_data() {
    return _public_data;
}


module.exports = {
    require_connection,
    get_user_private_data,
    error_404,
    error_403,
    session_data,
    public_data,
    events
}