const Users = require("./database/tables/user");
const Repos = require("./database/tables/repos");
const UserRepos = require("./database/tables/user_repos");

function require_connection(req, res) {
    if (!session_data(req).connected_user) {
        req.session.last_url = req.originalUrl;
        res.redirect('/signin');
        return true;
    }
    return false;
}

async function error_404(req, res, custom_error = null) {
    res.status(404);
    res.render('error', {
        title: "404 - Not found",
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        message: `404 - ${custom_error ? custom_error : 'Cette page n\'existe pas'}`
    })
}

async function error_403(req, res, custom_error = null) {
    res.status(403);
    res.render('error', {
        title: "403 - Forbidden",
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        message: `403 - ${custom_error ? custom_error : 'Cette page n\'est pas accessible'}`
    })
}

const available_sessions = {}

class SessionData {
    constructor(id) {
        this.id = id;
        this.connected_user = null;
        this.last_data = null;
        this.tracked_repos = new Set();
        this.user_tracked_repos = new Set();
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
            const tracked_repos = [];

            for (const key of this.tracked_repos) {
                const repos = await Repos.find_access_key(key)
                if (repos) {
                    tracked_repos.push({
                        access_type: 'visitor',
                        repos: await repos.public_data(false)
                    });
                }
            }

            if (this.connected_user) {
                for (const repos of await Repos.find_user(this.connected_user)) {
                    user_repos.push(await repos.public_data(false));
                }

                for (const user_repos of await UserRepos.find_user(this.connected_user)) {
                    tracked_repos.push({
                        access_type: user_repos.get_access(),
                        repos: await user_repos.get_repos().public_data()
                    })
                    this.user_tracked_repos.add(await user_repos.get_repos().get_access_key())
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

                tracked_repos: tracked_repos,
                selected_repos: this.selected_repos ? await this.selected_repos.public_data(true) : null,
            }
        }
        return this.last_data;
    }

    /**
     * @param repos {Repos|null}
     */
    async select_repos(repos = null) {
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

        if (repos)
            await this.view_repos(repos);

        return this;
    }

    async view_repos(repos) {
        if (this.connected_user) {
            if ((await repos.get_owner()).get_id() === this.connected_user.get_id())
                return;
        }

        if (await repos.get_status() !== 'private' &&
            !this.tracked_repos.has(await repos.get_access_key()) &&
            !this.user_tracked_repos.has(await repos.get_access_key())) {
            this.tracked_repos.add(await repos.get_access_key())
            this.mark_dirty();
        }
    }

    mark_dirty() {
        this.last_data = null;
    }
}

events = {
    on_delete_repos: async (repos) => {
        repos.delete();
        for (const session of Object.values(available_sessions)) {
            if (session.connected_user) {
                for (const user_repos of (await session.client_data()).user.repos)
                    if (user_repos.id === repos.get_id())
                        session.mark_dirty();
            }

            for (const user_repos of (await session.client_data()).tracked_repos)
                if (user_repos.repos.id === repos.get_id())
                    session.mark_dirty();
        }

        public_data().mark_dirty();
    },

    on_upload_file: async (repos) => {

        for (const session of Object.values(available_sessions))
            if (session.selected_repos && session.selected_repos.get_id() === repos.get_id())
                session.mark_dirty();
    }
}

class PublicData {

    constructor() {
        this.repos_list = null;
    }

    mark_dirty() {
        this.repos_list = null;
    }

    async get_repos_list() {
        if (!this.repos_list) {
            this.repos_list = [];
            for (const repos of await Repos.find_public()) {
                this.repos_list.push(await repos.public_data());
            }
        }
        return this.repos_list;
    }

    async get() {
        return {
            repos_list: await this.get_repos_list()
        }
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

function public_data() {
    return _public_data;
}

module.exports = {
    require_connection,
    error_404,
    error_403,
    session_data,
    public_data,
    events
}