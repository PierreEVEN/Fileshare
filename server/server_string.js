const assert = require("node:assert");

class ServerString {

    /**
     * @param data {ServerString|null}
     */
    constructor(data = null) {
        if (data && data._encoded_string_data) {
            assert(typeof data === 'object' && typeof data._encoded_string_data === 'string')
            this._encoded_string_data = data._encoded_string_data;
        }
    }

    /**
     * @param DbData {string}
     * @constructor {ServerString}
     */
    static FromDB(DbData) {
        let object = new ServerString();
        if (DbData) {
            assert(typeof DbData === 'string', "invalid field : " + DbData)
            object._encoded_string_data = DbData;
        }
        return object;
    }

    /**
     * @param DbData {string}
     * @constructor {ServerString}
     */
    static FromURL(DbData) {
        assert(typeof DbData === 'string', "invalid field : " + DbData)
        let object = new ServerString();
        object._encoded_string_data = encodeURIComponent(DbData);
        return object;
    }

    /**
     * Plain text decoded string
     * @return {string}
     */
    plain() {
        return this._encoded_string_data ? decodeURIComponent(this._encoded_string_data) : '';
    }

    /**
     * Encoded string data
     * @return {string}
     */
    encoded() {
        return this._encoded_string_data ? this._encoded_string_data : '';
    }

    /**
     * Url compatible string data
     * @return {string}
     */
    for_url() {
        return this._encoded_string_data ? this._encoded_string_data : '';
    }

    /**
     * @return {string}
     */
    toString() {
        return this.plain()
    }
}

module.exports = {ServerString}