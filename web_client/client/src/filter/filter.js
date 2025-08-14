import {EncString} from "../encstring";

class Filter {
    constructor() {
        this._repositories = [];
        this._name = null;
        this._before = null;
        this._after = null;
        this._max_size = null;
        this._min_size = null;
        this._mime_type = null;
        this._owners = null;
    }



    /**
     * @param other {Filter}
     * @returns {boolean}
     */
    equals(other) {
        if (!(this._name === other._name &&
            this._before === other._before &&
            this._after === other._after &&
            this._max_size === other._max_size &&
            this._min_size === other._min_size &&
            this._mime_type === other._mime_type))
            return false;

        if (this._owners && other._owners) {
            const a = new Set()
            const b = new Set()
            for (const owner of this._owners)
                a.add(owner);
            for (const owner of other._owners)
                b.add(owner);
            if (a.size !== b.size)
                return false;
            for (const owner of a)
                if (!b.has(owner))
                    return false;
        } else if (this._owners || other._owners)
            return false;

        if (this._repositories && other._repositories) {
            const a = new Set()
            const b = new Set()
            for (const repository of this._repositories)
                a.add(repository);
            for (const repository of other._repositories)
                b.add(repository);
            if (a.size !== b.size)
                return false;
            for (const owner of a)
                if (!b.has(owner))
                    return false;
        } else if (this._repositories || other._repositories)
            return false;

        return true;
    }

    /**
     * @param repository {number}
     * @param directory {number}
     * @returns {Filter}
     */
    source(repository, directory) {
        this._repositories.push({repository: repository, root_items: directory ? [directory] : []});
        return this;
    }

    name(name) {
        this._name = name;
        return this;
    }

    /**
     * @param item {RemoteItem}
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
        obj.repositories = this._repositories
        if (this._name)
            obj.name = new EncString(this._name)
        return obj;
    }
}

export {Filter};