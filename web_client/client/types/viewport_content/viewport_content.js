import {EventManager, GLOBAL_EVENTS} from "../event_manager";
import {MemoryTracker} from "../memory_handler";
import {DirectoryContentProvider, RepositoryRootProvider} from "./providers";
import {Repository} from "../repository";

class ContentFilter extends MemoryTracker {
    constructor() {
        super(ContentFilter)
        this._inner = null;
    }

    /**
     * @param item {FilesystemItem}
     * @returns {boolean}
     */
    test(item) {
        if (this._inner)
            if (!this._inner.test(item))
                return false;
        return this.filter(item);
    }

    /**
     * @param item {FilesystemItem}
     * @returns {boolean}
     */
    filter(item) {
        return true;
    }

    /**
     * @param filter {ContentFilter}
     * @return ContentFilter
     */
    join(filter) {
        this._inner = filter;
        return this._inner;
    }
}

class ContentProvider extends MemoryTracker {
    constructor() {
        super(ContentProvider)

        this.events = new EventManager();
        this._add_event = GLOBAL_EVENTS.add('add_item', async (item) => {
            await this._internal_add_item(item)
        })
    }

    /**
     * @return {Promise<FilesystemItem[]>}
     */
    async get_content() {
        return [];
    }

    async _internal_add_item(item) {

    }

    delete() {
        super.delete();
        this._add_event.remove();
    }
}

class ContentSorter extends MemoryTracker {
    constructor() {
        super(ContentSorter)
    }

    /**
     * @param entries
     * @param reverse
     * @return {{directories: *[], files: *[]}}
     */
    lex_sort_entries(entries, reverse = false) {
        const directories = [];
        const files = [];

        for (const entry of entries) {
            if (entry.is_regular_file)
                files.push(entry);
            else
                directories.push(entry)
        }

        if (reverse)
            return {
                directories: directories.sort((a, b) => b.name.plain().localeCompare(a.name.plain())),
                files: files.sort((a, b) => b.name.plain().localeCompare(a.name.plain()))
            };
        else
            return {
                directories: directories.sort((a, b) => a.name.plain().localeCompare(b.name.plain())),
                files: files.sort((a, b) => a.name.plain().localeCompare(b.name.plain()))
            };
    }

    /**
     * @param source {FilesystemItem[]}
     * @return {FilesystemItem[]}
     */
    sort_content(source) {
        return source;
    }

    /**
     * @param sorter {ContentSorter}
     * @return ContentSorter
     */
    join(sorter) {
        this._inner = sorter;
        return this._inner;
    }
}

class LexicographicSorter extends ContentSorter {
    sort_content(source) {
        let result = this.lex_sort_entries(source, false)
        return result.directories.concat(result.files);
    }
}

class ViewportContent extends MemoryTracker {

    constructor() {
        super(ViewportContent);

        /**
         * @type {Map<number, FilesystemItem>}
         * @private
         */
        this._displayed_items = new Map();

        /**
         * @type {EventManager}
         */
        this.events = new EventManager();

        /**
         * @type {ContentFilter|null}
         * @private
         */
        this._filter = null;

        /**
         * @type {ContentSorter|null}
         * @private
         */
        this._sorter = new LexicographicSorter();

        /**
         * @type {ContentProvider|null}
         * @private
         */
        this._provider = null;

        this._pending_regeneration = false;

        this._listener_remove = GLOBAL_EVENTS.add('remove_item', async (item) => {
            await this._remove_entry(item);

            if (this._provider instanceof DirectoryContentProvider) {
                if (await this._provider.directory.is_in_parents(item.id) || this._provider.directory.id === item.id)
                    await this.set_content_provider(new RepositoryRootProvider(await Repository.find(this._provider.directory.repository)))
            }
        })
    }

    delete() {
        super.delete();
        if (this._filter)
            this._filter.delete();
        this._filter = null;
        if (this._sorter)
            this._sorter.delete();
        this._sorter = null;
        if (this._provider)
            this._provider.delete();
        this._provider = null;
        if (this.add_event)
            this.add_event.remove();
        this._listener_remove.remove();
    }

    /**
     * @param filter {ContentFilter|null}
     */
    async set_filter(filter) {
        if (this._filter)
            this._filter.delete();
        this._filter = filter;
        await this._regen_content();
    }

    /**
     * @param sorter {ContentSorter|null}
     */
    async set_sorter(sorter) {
        if (this._sorter)
            this._sorter.delete();
        this._sorter = sorter;
        await this._regen_content();
    }

    /**
     * @param provider {ContentProvider|null}
     */
    async set_content_provider(provider) {
        if (this.add_event)
            this.add_event.remove();
        if (this._provider)
            this._provider.delete();
        this._provider = provider;
        this.add_event = this._provider.events.add('add', (item) => {
            if (this._pending_regeneration)
                return;
            if (this._filter) {
                if (this._filter.test(item))
                    this._add(item)
            } else
                this._add(item)
        })
        await this._regen_content();
    }

    /**
     * @return {ContentProvider|null}
     */
    get_content_provider() {
        return this._provider
    }

    get_filesystem() {
        for (const item of this._displayed_items.values()) {
            return item.filesystem();
        }
        return null;
    }

    async _add(item) {
        if (this._displayed_items.has(item.id))
            return;
        this._displayed_items.set(item.id, item);
        await this.events.broadcast('add', item);
    }

    async _remove_entry(item) {
        if (!this._displayed_items.has(item.id))
            return;
        this._displayed_items.delete(item.id);
        await this.events.broadcast('remove', item);
    }

    async _clear() {
        for (const item of this._displayed_items.values())
            await this._remove_entry(item);
    }

    async _regen_content() {
        await this._clear();

        if (!this._provider)
            return;
        this._pending_regeneration = true;
        const sources = await this._provider.get_content();
        this._pending_regeneration = false;
        let filtered_sources = [];

        if (this._filter) {
            for (const item of sources)
                if (this._filter.test(item))
                    filtered_sources.push(item);
        } else
            filtered_sources = sources;

        if (this._sorter)
            filtered_sources = this._sorter.sort_content(filtered_sources);

        for (const source of filtered_sources) {
            await this._add(source);
        }
    }
}

export {ViewportContent, ContentFilter, ContentSorter, ContentProvider}