/**
 * @callback callback_exists_id
 * @param uid {number}
 */

const {randomBytes} = require("crypto");

/**
 * @param callback_exists {callback_exists_id}
 * @param id_base {Set<number>|null}
 * @return {Promise<number>}
 */
async function gen_uid(callback_exists, id_base = null) {
    let id = null;
    do {
        id = Math.floor(Math.random() * 147483647);
    } while ((!id_base || id_base.has(id)) && await callback_exists(id));
    if (id_base)
        id_base.add(id);
    return id;
}

/**
 * @callback callback_exists_hash
 * @param uid {string}
 */

/**
 * @param callback_exists {callback_exists_hash}
 * @param id_base {Set<string>|null}
 * @return {Promise<string>}
 */
async function gen_uhash(callback_exists, id_base= null) {
    let id = null;
    do {
        id = randomBytes(16).toString("hex");
    } while ((!id_base || id_base.has(id)) && await callback_exists(id));
    if (id_base)
        id_base.add(id);
    return id;
}

module.exports = {gen_uid, gen_uhash}