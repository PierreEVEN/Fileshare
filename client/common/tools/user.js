import {parse_fetch_result} from "../widgets/message_box";

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
        for (const cookie of document.cookie.split(";")) {
            document.cookie = `${cookie}; SameSite=Strict; expires=${new Date(0).toUTCString()}`
        }
        for (const [key, value] of this._cookies.entries()) {
            if (value.exp)
                document.cookie = `${key}=${value.value}; SameSite=Strict; expire=${new Date(value.exp).toUTCString()}`
            else
                document.cookie = `${key}=${value.value}; SameSite=Strict`
        }
    }
}

class User {
    constructor() {
        const cookies = new CookieString(document.cookie);
        this._authtoken = cookies.read("authtoken");
        this._last_uri = document.documentURI;
        if (this._authtoken)
            this._authtoken_exp = cookies.read("authtoken-exp");
        this.save_cookies();
    }

    get_token() {
        return this._authtoken;
    }

    async login(username, password) {
        const data = new URLSearchParams();
        data.append('username', username);
        data.append('password', password);
        const authtoken = await parse_fetch_result(await fetch('/api/create-authtoken',
            {
                method: 'POST',
                body: data
            }));
        if (authtoken.token) {
            this._authtoken = authtoken.token;
            this._authtoken_exp = authtoken.expiration_date;
            this.save_cookies();
            window.location.reload()
        }
    }

    async register(username, email, password) {
        const data = new URLSearchParams();

        data.append('username', username);
        data.append('email', email);
        data.append('password',password);
        const authtoken = await parse_fetch_result(await fetch('/api/create-user',
            {
                method: 'POST',
                body: data
            }));
        this._authtoken = authtoken.token;
        this._authtoken_exp = authtoken.expiration_date;
        this.save_cookies();
        window.location = `/${username}/`
    }

    async logout() {
        if (this._authtoken)
            await parse_fetch_result(await fetch(`/api/delete-authtoken/${this._authtoken}`,
                {
                    method: 'POST',
                    headers: {
                        'content-authtoken': this._authtoken
                    }
                }));
        delete this._authtoken;
        delete this._authtoken_exp;
        this.save_cookies();
        window.location.reload()
    }

    save_cookies() {
        const cookies = new CookieString();

        if (this._authtoken)
            if (this._authtoken_exp)
                cookies.set("authtoken", this._authtoken, this._authtoken_exp)
            else
                cookies.set("authtoken", this._authtoken, new Date().getTime() + 36000000)
        console.log(this._authtoken)
        if (this._authtoken_exp)
            cookies.set("authtoken-exp", this._authtoken_exp)
        cookies.save();
    }
}

const LOCAL_USER = new User();

window.LOCAL_USER = LOCAL_USER;

export {LOCAL_USER}