class ClientString {

    /**
     * @param data {ClientString|null}
     */
    constructor(data = null) {
        if (data && data._encoded_string_data) {
            console.assert(typeof data === 'object' && typeof data._encoded_string_data === 'string', "invalid source string data : ", data)
            this._encoded_string_data = data._encoded_string_data;
        }
    }

    /**
     * @param DbData {string}
     * @constructor {ClientString}
     */
    static FromClient(DbData) {
        let object = new ClientString();
        if (DbData) {
            console.assert(typeof DbData === 'string')
            object._encoded_string_data = encodeURIComponent(DbData);
        }
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
        return this.plain();
    }
}

class UrlPath {

    constructor() {
    }

    absolute_url() {

    }
}

export {ClientString,UrlPath}