import {EncString} from "./encstring";
import {FilesystemStream} from "./filesystem_stream";
import {fetch_api} from "../utilities/request";
import {GLOBAL_EVENTS} from "./event_manager";
import {Message, NOTIFICATION} from "../modules/index/tools/message_box/notification";
import {APP_COOKIES} from "../modules/index/tools/cookies/cookies";

class RepositoryStatus {
    constructor(data) {
        this._role = '';
        switch (data) {
            case "Private":
            case "Hidden":
            case "Public":
                /**
                 * @type{string}
                 * @private
                 */
                this._role = data.toString();
                break;
        }
    }

    toString() {
        return this._role;
    }
}


class Repository {

    /**
     * @type {Map<number, Repository>}
     * @private
     */
    static _LOCAL_CACHE = new Map();

    constructor(data) {
        /**
         * @type {number}
         */
        this.id = data.id;
        /**
         * @type {EncString}
         */
        this.url_name = new EncString(data.url_name);
        /**
         * @type {number}
         */
        this.owner = data.owner
        /**
         * @type {EncString}
         */
        this.description = new EncString(data.description);
        /**
         * @type {RepositoryStatus}
         */
        this.status = new RepositoryStatus(data.status);
        /**
         * @type {EncString}
         */
        this.display_name = new EncString(data.display_name);
        /**
         * @type {number}
         */
        this.max_file_size = data.max_file_size;
        /**
         * @type {number}
         */
        this.visitor_file_lifetime = data.visitor_file_lifetime;
        /**
         * @type {number}
         */
        this.allow_visitor_upload = data.allow_visitor_upload;

        /**
         * @type {FilesystemStream}
         */
        this.content = new FilesystemStream(this)

        if (Repository._LOCAL_CACHE.has(this.id))
            console.error("Don't use new constructor on repository")

        Repository._LOCAL_CACHE.set(this.id, this);

        GLOBAL_EVENTS.broadcast('add_repository', this);
    }

    static new(data) {
        const existing = Repository._LOCAL_CACHE.get(data.id);
        if (existing)
            return existing;
        APP_COOKIES.push_last_repositories(data.id);
        return new Repository(data)
    }

    /**
     * @return {void}
     */
    download() {
        window.open(`/api/repository/download/${this.id}/`);
    }

    refresh() {
        GLOBAL_EVENTS.broadcast('remove_repository', this);
        GLOBAL_EVENTS.broadcast('add_repository', this);
    }

    /**
     * @return {Repository}
     */
    display_data() {
        const result = JSON.parse(JSON.stringify(this));
        result.url_name = this.url_name.plain()
        result.description = this.description.plain()
        result.display_name = this.display_name.plain()
        return result
    }

    /**
     * @param repos {number|number[]}
     * @returns {Promise<Repository|Repository[]>}
     */
    static async find(repos) {
        const is_array = repos.constructor.name === 'Array';
        const ids = is_array ? repos : [repos];

        const found = [];
        const not_found = [];
        for (const id of ids) {
            console.assert(id, "Invalid repository ID !");
            const local = Repository._LOCAL_CACHE.get(id);
            if (local)
                found.push(local);
            else
                not_found.push(id);
        }
        let repositories = await fetch_api('repository/find', 'POST', not_found)
            .catch(error => {
                NOTIFICATION.warn(new Message(`Impossible de récupérer les dépots ${not_found} : ${error.message}`))
                throw error;
            });
        for (const repository of repositories)
            found.push(Repository.new(repository));

        return is_array ? found : repos.length > 0 ? found[0] : null;
    }

    remove() {
        Repository._LOCAL_CACHE.delete(this.id);
        GLOBAL_EVENTS.broadcast('remove_repository', this);
    }

    toJSON() {
        const data = {};
        for (const [key, value] of Object.entries(this)) {
            if (key !== 'content')
                data[key] = value;
        }
        return data;
    }

    /**
     * @return {Promise<Repository[]>}
     */
    static async my_repositories() {
        const my_repositories = await fetch_api('repository/owned')
            .catch(error => {
                NOTIFICATION.error(new Message(error).title(`Impossible de télécharger la liste des dépôts possédés`));
                return [];
            });
        const repositories = [];
        for (const repository of my_repositories) {
            repositories.push(Repository.new(repository));
        }
        return repositories;
    }

    /**
     * @return {Promise<Repository[]>}
     */
    static async shared_repositories() {
        const shared_repositories = await fetch_api('repository/shared')
            .catch(error => {NOTIFICATION.warn(new Message(error).title("Impossible de récupérer les dépôts partagés")); return;});
        const repositories = [];
        for (const repository of shared_repositories) {
            repositories.push(Repository.new(repository));
        }
        return repositories;
    }
}

export {Repository, RepositoryStatus}