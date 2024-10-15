class EventHandle {
    constructor(manager, callback, name, id) {
        this._manager = manager;
        this._callback = callback;
        this._name = name;
        this._id = id;
    }

    remove() {
        const event = this._manager._events.get(this._name);
        if (event)
            event.delete(this._id);
    }

    execute(payload) {
        this._callback(payload);
    }
}

class EventManager {

    constructor() {
        /**
         * @type {Map<string, Map<number, EventHandle>>}
         * @private
         */
        this._events = new Map();

        this._id = 0;
    }

    /**
     * @param event {string}
     * @param callback {function}
     * @return {EventHandle}
     */
    add(event, callback) {
        const id = ++this._id;
        const handle = new EventHandle(this, callback, event, id);
        let events = this._events.get(event);
        if (!events) {
            events = new Map();
            this._events.set(event, events);
        }
        events.set(id, handle);
        return handle;
    }

    /**
     * @param event {string}
     * @param payload {any}
     */
    async broadcast(event, payload) {
        const callbacks = this._events.get(event);
        if (callbacks)
            for (const callback of callbacks.values())
                await callback.execute(payload);
    }
}

const GLOBAL_EVENTS = new EventManager();

export {GLOBAL_EVENTS, EventManager}