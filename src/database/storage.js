const FREE_TIMEOUT = 10 * 1000;
class Storage {

    constructor() {
        this.content = {}
    }

    find(id) {
        const found = this.content[id]
        if (found) {

            clearTimeout(found.timeout_id);
            found.timeout_id =  setTimeout(() => {
                delete this.content[id];
            }, FREE_TIMEOUT)
            return found.object;
        }
        return null;
    }

    add(id, object) {
        this.content[id] = {
            object: object, timeout_id: setTimeout(() => {
                delete this.content[id];
            }, FREE_TIMEOUT)
        }
    }
}

module.exports = Storage;