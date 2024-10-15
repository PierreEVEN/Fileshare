import {MODAL} from "../../modal/modal";
import {fetch_api} from "../../../../utilities/request";
import {EncString} from "../../../../types/encstring";
import {APP_COOKIES} from "../../../../utilities/cookies";
import {APP_CONFIG} from "../../../../types/app_config";
import {Message, NOTIFICATION} from "../message_box/notification";
import {User} from "../../../../types/user";

const Authentication = {
    login: async () => {
        return await new Promise((success, fail) => {
            let login_div = require('./login.hbs')({}, {
                login: async (event) => {
                    event.preventDefault();
                    let result = await fetch_api('user/login/', 'POST', {
                        login: EncString.from_client(login_div.elements.login.value),
                        password: EncString.from_client(login_div.elements.password.value),
                        device: EncString.from_client(navigator.userAgent)
                    }).catch(error => {
                        NOTIFICATION.error(new Message(error).title("Connexion échouée"));
                    });
                    if (!result)
                        return;
                    APP_COOKIES.login(result.token);
                    APP_CONFIG.set_connected_user(User.new(result.user));
                    success();
                    MODAL.close();
                },
                signup: () => {
                    Authentication.signup().then(success).catch(fail);
                },
                reset_password: () => {
                    fail();
                }
            });
            MODAL.open(login_div, {
                custom_width: '500px', custom_height: '400px', on_close:
                    () => {
                        fail("Authentification annulée");
                    }
            });
        });
    },
    signup: async () => {
        return await new Promise((success, fail) => {
            const signup_div = require('./signup.hbs')({},  {
                signup: async (event) => {
                    event.preventDefault();
                    let errored = false;
                    await fetch_api('user/create/', 'POST', {
                        username: EncString.from_client(signup_div.elements.login.value),
                        email: EncString.from_client(signup_div.elements.email.value),
                        password: EncString.from_client(signup_div.elements.password.value)
                    }).catch(error => {
                        errored = true;
                        NOTIFICATION.error(new Message(error).title("Impossible de créer l'utilisateur"));
                        fail(`Authentication failed : ${error.message}`)
                    });
                    if (errored)
                        return;

                    let login_result = await fetch_api('user/login/', 'POST', {
                        login: EncString.from_client(signup_div.elements.login.value),
                        password: EncString.from_client(signup_div.elements.password.value),
                        device: EncString.from_client(navigator.userAgent)
                    }).catch(error => {
                        NOTIFICATION.error(new Message(error).title("Connexion échouée"));
                        fail(`Authentication failed : ${error.message}`)
                    });
                    APP_COOKIES.login(login_result.token);
                    APP_CONFIG.set_connected_user(User.new(login_result.user))
                    success();
                    MODAL.close();
                },
                login: () => {
                    Authentication.login().then(success).catch(fail);
                }
            });
            MODAL.open(signup_div, {
                custom_width: '500px', custom_height: '400px', on_close: () => {
                    fail("Authentification annulée");
                }
            });
        });
    },
    logout: async () => {
        await fetch_api('user/logout/', 'POST')
            .catch(error => NOTIFICATION.error(new Message(error).title("Erreur lors de la déconnexion")));
        APP_COOKIES.logout();
        APP_CONFIG.set_connected_user(null);
    }
}

export {Authentication}