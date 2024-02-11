
class User {

    constructor() {
        this._token = null;
    }

    get_token() {
        return this._token;
    }

    async login(username, password) {

    }
}

const LOCAL_USER = new User();

export {LOCAL_USER}