/**
 * @callback callback_exists_id
 * @param uid {number}
 */

const {randomBytes} = require("crypto");

/**
 * @param callback_exists {callback_exists_id}
 * @return {Promise<number>}
 */
async function gen_uid(callback_exists) {
    let id = null;
    do {
        id = Math.floor(Math.random() * 147483647);
    } while (await callback_exists(id));
    return id;
}

/**
 * @callback callback_exists_hash
 * @param uid {string}
 */

/**
 * @param callback_exists {callback_exists_hash}
 * @return {Promise<string>}
 */
async function gen_uhash(callback_exists) {
    let id = null;
    do {
        id = randomBytes(16).toString("hex");
    } while (await callback_exists(id));
    return id;
}

module.exports = {gen_uid, gen_uhash}