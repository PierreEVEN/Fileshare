class MemoryHandler {
    constructor() {
        this.items = {};
    }
}

const MEMORY_HANDLER = new MemoryHandler();


class MemoryTracker {
    /**
     * @param internal {Class}
     */
    constructor(internal) {
        console.assert(internal, "Class was not provided to memory tracker");
        console.assert(internal.prototype instanceof MemoryTracker, "Invalid class provided to memory tracker");
        this._internal_class_name = internal;
        MEMORY_HANDLER.items[this._internal_class_name]++;
    }

    delete() {
        MEMORY_HANDLER.items[this._internal_class_name]--;
    }
}

export {MEMORY_HANDLER, MemoryTracker}