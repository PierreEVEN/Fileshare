import {APP_CONFIG} from "../../../../types/app_config";
import {Message, NOTIFICATION} from "../message_box/notification";
import {MODAL} from "../../modal/modal";

const dayjs = require('dayjs')
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

require('./cookies.scss')

class CookieString {
    constructor(data) {
        this._cookies = new Map();
        if (!data)
            return;

        const ca = data.split(';');
        for (const c of ca) {
            const s = c.split("=");
            if (s.length === 1)
                continue;
            if (s[1].length === 0)
                continue;
            this.set(s[0][0] === " " ? s[0].substring(1) : s[0], s[1]);
        }
    }

    set(key, value, exp = null) {
        if ((!value === null) && this._cookies[key])
            delete this._cookies.delete(key);
        this._cookies.set(key, {value: value, exp: exp});
    }

    read(key) {
        const cookie = this._cookies.get(key);
        return cookie ? cookie.value : null;
    }

    save() {
        if (document.cookie.length !== 0)
            for (const cookie of document.cookie.split(";"))
                document.cookie = `${cookie}; SameSite=Strict; expires=${new Date(0).toUTCString()}; path=/`;

        for (const [key, value] of this._cookies.entries()) {
            if (value.exp)
                document.cookie = `${key}=${value.value}; SameSite=Strict; expire=${dayjs.unix(value.exp).toDate().toUTCString()}; Max-Age=${value.exp - dayjs().unix()}; path=/`
            else
                document.cookie = `${key}=${value.value}; SameSite=Strict; Max-Age=${86400 * 365 * 10}; path=/`
        }
    }
}

class AppCookies {
    constructor() {
        const cookies = new CookieString(document.cookie);
        this._authtoken = cookies.read("authtoken");
        this._last_uri = document.documentURI;
        if (this._authtoken)
            this._authtoken_exp = cookies.read("authtoken-exp");

        this._allow_cookies = Boolean(cookies.read("allow-cookies"));
        this._stay_connected = cookies.read("stay-connected");
        if (!this._allow_cookies) {
            this._cookies_div = require("./cookies_div.hbs")({}, {
                enable: () => {
                    this._allow_cookies = true;
                    this.save_cookies();
                    this._cookies_div.remove();
                },
                skip: () => {
                    this._allow_cookies = false;
                    this.save_cookies();
                    this._cookies_div.remove();
                }
            });
            document.body.append(this._cookies_div);
        }

        /**
         * @type {string | null}
         * @private
         */
        this._last_repos = cookies.read("last-repos")
        if (!this._last_repos)
            this._last_repos = "";
        this.save_cookies();
    }

    get_token() {
        return this._authtoken;
    }

    /**
     * @returns {number[]}
     */
    get_last_repositories() {
        return this._last_repos.split('.').filter(Boolean);
    }

    /**
     * @param repos_id {number}
     */
    push_last_repositories(repos_id) {
        let repos_list = this._last_repos.split('.').filter(Boolean);
        if (repos_list.length > 10) {
            repos_list = repos_list.reverse();
            repos_list.pop();
            repos_list = repos_list.reverse();
        }
        const new_repos_list = [];
        for (const repo of repos_list)
            if (String(repos_id) !== String(repo))
                new_repos_list.push(repo)

        new_repos_list.push(repos_id)
        this._last_repos = '';
        for (const item of new_repos_list)
            this._last_repos += `${item}.`;
        this.save_cookies();
    }

    authentication_headers(header) {
        if (!header)
            header = {};
        header['content-authtoken'] = this._authtoken;
        return header;
    }

    /**
     * @param authentication_token {Object}
     * @param stay_connected {boolean}
     */
    async login(authentication_token, stay_connected) {
        if (authentication_token && authentication_token.token) {
            if (!this._allow_cookies && stay_connected) {
                this._allow_cookies = await new Promise((resolve) => {
                    MODAL.open(require('./ask_for_cookies.hbs')({}, {
                        validate: () => {
                            if (this._cookies_div)
                                this._cookies_div.remove();
                            resolve(true);
                        },
                        reject: () => {
                            resolve(false);
                        }
                    }), {
                        on_close: () => {
                            resolve(false);
                        }
                    });
                });
            }
            this._stay_connected = stay_connected;
            this._authtoken = authentication_token.token;
            this._authtoken_exp = authentication_token.expiration_date;
            this.save_cookies();
        } else {
            NOTIFICATION.error(new Message("Invalid authentication token"))
        }
    }

    logout() {
        delete this._authtoken;
        delete this._authtoken_exp;
        this.save_cookies();
        APP_CONFIG.set_connected_user(null);
    }

    save_cookies() {
        const cookies = new CookieString();

        // Don't save if not allowed on current browser
        if (this._allow_cookies)
            cookies.set("allow-cookies", this._allow_cookies);
        else
            return cookies.save();

        cookies.set("stay-connected", this._stay_connected);
        if (this._stay_connected) {
            if (this._authtoken)
                if (this._authtoken_exp)
                    cookies.set("authtoken", this._authtoken, this._authtoken_exp)
                else
                    cookies.set("authtoken", this._authtoken, dayjs().unix() + 1000 * 60 * 60 * 24 * 30)
            if (this._authtoken_exp)
                cookies.set("authtoken-exp", this._authtoken_exp)
        }
        cookies.set("last-repos", this._last_repos)
        cookies.save();
    }
}

const APP_COOKIES = new AppCookies();

export {APP_COOKIES}