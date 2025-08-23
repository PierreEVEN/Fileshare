class Permission {

    constructor(level) {
        this._level = level;
    }

    /**
     * @returns {Permission}
     */
    static read_only() {
        return new Permission('r');
    }

    /**
     * @returns {Permission}
     */
    static add_content() {
        return new Permission('a');
    }

    /**
     * @returns {Permission}
     */
    static full() {
        return new Permission('f');
    }

    /**
     * @param required {Permission}
     * @returns {boolean}
     */
    allow(required) {
        return required.level() <= this.level();
    }

    /**
     * @returns {number}
     */
    level() {
        if (this._level === 'r')
            return 1;
        if (this._level === 'a')
            return 2;
        if (this._level === 'f')
            return 3;
        return 0;
    }

    toString() {
        return this._level.toString();
    }

    toJSON() {
        return this._level.toString()
    }
}

export {Permission}