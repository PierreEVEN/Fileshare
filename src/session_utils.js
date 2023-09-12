const {User} = require("./database/user");
const {Repos} = require("./database/repos");
const {UserRepos} = require("./database/user_repos");
const {logger} = require("./logger");

function require_connection(req, res) {
    if (!session_data(req).connected_user) {
        req.session.last_url = req.originalUrl;
        res.redirect('/signin');
        return true;
    }
    return false;
}

async function error_404(req, res, custom_error = null) {
    const user = session_data(req).connected_user;
    logger.error(`404 Not found : ${req.originalUrl} (${request_username(req)})`)
    res.status(404).render('error', {
        title: "404 - Not found",
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        message: `404 - ${custom_error ? custom_error : 'Cette page n\'existe pas'}`
    })
}

async function error_403(req, res, custom_error = null) {
    res.status(403).render('error', {
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

    /**
     * @param user {User | null}
     * @return {Promise<SessionData>}
     */
    async connect_user(user = null) {
        if (user) {
            const new_connection = !this.connected_user;
            this.connected_user = user;
            if (new_connection)
                logger.info(`new connection from ${this.connected_user.name}#${this.connected_user.id}`)
        }
        else {
            if (this.connected_user)
                logger.info(`${this.connected_user.name}#${this.connected_user.id} disconnected`)
            this.connected_user = null;
        }

        this.last_data = null;

        return this;
    }

    async client_data() {
        if (!this.last_data) {

            const user_repos = []
            const tracked_repos = [];

            for (const key of this.tracked_repos) {
                const repos = await Repos.from_access_key(key)
                if (repos) {
                    tracked_repos.push({
                        access_type: 'visitor',
                        repos: repos
                    });
                }
            }

            if (this.connected_user) {
                this.connected_user.repos = [];
                for (const repos of await Repos.from_owner(this.connected_user)) {
                    this.connected_user.repos.push(repos);
                }
            }

            this.last_data = {
                user: this.connected_user,
                tracked_repos: tracked_repos,
                selected_repos: this.selected_repos ? await this.selected_repos.public_data(true) : null,
            }
        }
        return this.last_data;
    }

    /**
     * @param repos {number|null}
     */
    async select_repos(repos = null) {
        if (!repos && this.selected_repos) {
            this.selected_repos = null;
            this.mark_dirty();
        }

        if (repos && !this.selected_repos) {
            this.selected_repos = Repos.from_id(repos);
            this.mark_dirty();
        }

        if (repos && this.selected_repos && repos !== this.selected_repos.repos) {
            this.selected_repos = Repos.from_id(repos);
            this.mark_dirty();
        }

        if (this.selected_repos)
            await this.view_repos(this.selected_repos);

        return this;
    }

    /**
     * @param repos {Repos}
     * @return {Promise<void>}
     */
    async view_repos(repos) {
        if (this.connected_user) {
            if (await repos.owner === this.connected_user.id)
                return;
        }

        if (repos.status !== 'private' &&
            !this.tracked_repos.has(await repos.access_key) &&
            !this.user_tracked_repos.has(await repos.access_key)) {
            this.tracked_repos.add(await repos.access_key)
            this.mark_dirty();
        }
    }

    mark_dirty() {
        this.last_data = null;
    }
}

events = {
    /**
     * @param repos {Repos}
     * @return {Promise<void>}
     */
    on_delete_repos: async (repos) => {
        await repos.delete();
        for (const session of Object.values(available_sessions)) {
            if (session.connected_user) {
                for (const user_repos of (await session.client_data()).user.repos)
                    if (user_repos.id === repos.id)
                        session.mark_dirty();
            }

            for (const user_repos of (await session.client_data()).tracked_repos)
                if (user_repos.repos.id === repos.id)
                    session.mark_dirty();
        }

        public_data().mark_dirty();
    },

    /**
     * @param repos {Repos}
     * @return {Promise<void>}
     */
    on_upload_file: async (repos) => {
        for (const session of Object.values(available_sessions))
            if (session.selected_repos && session.selected_repos.id === repos.id)
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
            for (const repos of await Repos.with_public_access()) {
                this.repos_list.push(repos);
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

function request_username(req) {
    const user = session_data(req).connected_user;
    return user ? `${user.name}#${user.id}` : `@{${req.socket.remoteAddress}}`
}

module.exports = {
    request_username,
    require_connection,
    error_404,
    error_403,
    session_data,
    public_data,
    events
}