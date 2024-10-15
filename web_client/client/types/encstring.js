
function custom_encode(data) {
    return encodeURIComponent(data)
        .replaceAll("(", "%28")
        .replaceAll(")", "%29")
        .replaceAll("'", "%27")
        .replaceAll("*", "%2A")
        .replaceAll("!", "%21")
}

class EncString {

    /**
     * @type {string}
     * @private
     */
    constructor(data) {
        if (data)
            console.assert(typeof data === 'string', "Trying to encode a non string type !");
        /**
         * @type {string}
         * @private
         */
        this.__encoded = data ? data : '';
    }

    /**
     * @returns {string}
     */
    plain() {
        return decodeURIComponent(this.__encoded)
    }

    /**
     * @returns {string}
     */
    encoded() {
        return this.__encoded;
    }

    /**
     * @param raw_string {String}
     * @returns {*}
     */
    static from_client(raw_string) {
        return new EncString(raw_string ? custom_encode(raw_string) : '')
    }

    toJSON() {
        return this.__encoded
    }
}

export {EncString}