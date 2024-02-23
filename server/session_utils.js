const {User} = require("./database/user");
const {Repos} = require("./database/repos");
const {logger} = require("./logger");

function require_connection(req, res) {
    if (!session_data(req).connected_user) {
        req.session.last_url = req.originalUrl;
        if (req.method === 'POST' || req.headers["no-redirect"])
            res.status(403).send('Connection required');
        else
            res.redirect('/auth/signin');
        return true;
    }
    return false;
}

async function error_404(req, res, custom_error = null) {
    logger.error(`404 Not found : ${req.originalUrl} (${request_username(req)})`)
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
        } else {
            if (this.connected_user)
                logger.info(`${this.connected_user.name}#${this.connected_user.id} disconnected`)
            this.connected_user = null;
        }

        this.last_data = null;

        return this;
    }

    async client_data() {
        if (!this.last_data) {
            const tracked_repos = [];

            // Get tracked repos
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
                for (const repos of await Repos.from_owner(this.connected_user.id)) {
                    this.connected_user.repos.push(repos);
                }
            }

            this.last_data = {
                user: this.connected_user,
                tracked_repos: tracked_repos,
                selected_repos: this.selected_repos,
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

        if (repos && this.selected_repos && repos !== this.selected_repos.repos) {
            this.selected_repos = repos;
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

async function repos_updated(repos) {
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

    if (repos.status === 'public')
        public_data().mark_dirty();
}

events = {
    /**
     * @param repos {Repos}
     * @return {Promise<void>}
     */
    on_update_repos: repos_updated,

    /**
     * @param repos {Repos}
     * @return {Promise<void>}
     */
    on_delete_repos: async (repos) => {
        await repos.delete();
        await repos_updated(repos);
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


/**
 * @param req {Request}
 * @return {Promise<User>}
 */
async function get_user_from_request(req) {
    if (req.headers['auth-token']) {
        return await User.from_auth_token(req.headers['auth-token']);
    }
    if (req.sessionID)
        if (available_sessions[req.sessionID])
            return available_sessions[req.sessionID].connected_user;
    return null;
}

async function get_common_data(req) {
    const data = {};
    data.tracked_repos = [];
    data.repos_list = [];
    data.user_repos = [];
    data.selected_repos = Object.assign({}, req.repos)
    if (req.repos) {
        data.selected_repos.owner = (await User.from_id(req.repos.owner)).publicData();
        if (!data.selected_repos.owner)
            logger.error(`Cannot find owner of repos ${data.selected_repos.name}#${data.selected_repos.id}`)
    }

    if (req.local_user) {
        data.user = req.local_user;
        for (const repos of await Repos.from_owner(req.local_user.id)) {
            data.user_repos.push(repos);
        }
    }

    return data;
}

module.exports = {
    request_username,
    require_connection,
    error_404,
    error_403,
    session_data,
    public_data,
    get_user_from_request,
    events,
    get_common_data
}