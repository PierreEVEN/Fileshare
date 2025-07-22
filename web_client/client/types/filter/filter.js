import {EncString} from "../encstring";

class Filter {
    constructor() {
        this._repositories = null;
        this._name = null;
        this._before = null;
        this._after = null;
        this._max_size = null;
        this._min_size = null;
        this._mime_type = null;
        this._owners = null;
    }

    name(name) {
        this._name = name;
        return this;
    }

    /**
     * @param item {FilesystemItem}
     */
    test(item) {
        if (this._name) {
            if (!item.name.plain().includes(this._name))
                return false;
        }
        return true;
    }

    data() {
        const obj = {};
        if (this._name)
            obj.name = new EncString(this._name)
        return obj;
    }
}

export {Filter};