import {humanFileSize, is_touch_device} from "../../../common/tools/utils";
import {REPOS_BUILDER} from "./repos_builder";
import {LexicographicFilter} from "./filter/filter_lex";
import {SizeFilter} from "./filter/filter_size";

const make_directory_hbs = require("./menus/make_directory.hbs");
const {print_message, parse_fetch_result} = require("../components/message_box");
const {PAGE_CONTEXT} = require("../../../common/tools/utils");
const {ClientString} = require("../../../common/tools/client_string");
const {FilesystemObject} = require("../../../common/tools/filesystem_v2");
const {close_modal, open_modal} = require("../components/modal");
const {spawn_context_action} = require("../components/context_action");
const directory_hbs = require("./directory.hbs");
const {spawn_item_context_action} = require("./item_context_action");
const file_hbs = require("./file.hbs");
const {Carousel} = require("../components/carousel/carousel");
const {CarouselList} = require("../components/carousel/list/carousel_list");

/**
 * @type {ReposFilter}
 */
let last_filter = null;

/**
 * @type {boolean}
 */
let show_all_files = false;

/**
 * @type {string}
 */
let string_filter = '';

class DirectoryContent {
    /**
     * @param navigator{Navigator}
     */
    constructor(navigator) {
        /**
         * @type {Navigator}
         */
        this.navigator = navigator;

        /**
         * @type {{id:number, data:FilesystemObject}[]}
         */
        this.objects = [];

        /**
         * @type {HTMLElement}
         */
        this.viewport_container = document.getElementById('file-list');

        /**
         * @type {Map<number, HTMLElement>}
         */
        this.entry_widgets = new Map();

        /**
         * @type {Carousel}
         */
        this.item_carousel = null;

        if (!last_filter)
            last_filter = new LexicographicFilter(this.navigator.filesystem);

        /**
         * @type {ObjectListener}
         */
        this.current_directory_listener = navigator.filesystem.create_listener(navigator.get_current_directory());
        if (this.current_directory_listener) {
            this.current_directory_listener.on_add_object = (object_id) => {
                const object = navigator.filesystem.get_object_data(object_id);
                if (object.is_regular_file)
                    this._on_file_added(object);
                else
                    this._on_directory_added(object);
            };

            this.current_directory_listener.on_remove_object = (object_id) => {
                this._on_item_removed(object_id)
            };

            this.current_directory_listener.on_update_object = (object_id) => {
                this._on_item_removed(object_id);
                const new_data = navigator.filesystem.get_object_data(object_id);
                if (new_data) {
                    if (new_data.is_regular_file)
                        this._on_file_added(new_data);
                    else
                        this._on_directory_added(new_data);
                }
            };
        }

        this.navigator.bind_on_select_item((item, should_select) => {
            const widget = this.entry_widgets.get(item)
            if (widget) {
                if (should_select) {
                    widget.classList.add("selected");
                    widget.scrollIntoView({
                        behavior: "smooth", block: "nearest" +
                            "", inline: "nearest"
                    });
                } else {
                    widget.classList.remove("selected");
                }
            }
        })

        this.regen_content();
        const file_background = document.getElementById('file-list-box');
        if (file_background)
            file_background.oncontextmenu = event => {
                if (event.target !== file_background && event.target !== document.getElementById('file-list')) {
                    event.preventDefault();
                    return;
                }
                const actions = [];
                actions.push({
                    title: "Nouveau Dossier",
                    action: async () => {
                        const make_directory = make_directory_hbs({}, {
                            mkdir: async (e) => {
                                e.preventDefault();
                                const re = /[<>:"\/\\|?*\x00-\x1F]|^(?:aux|con|clock\$|nul|prn|com[1-9]|lpt[1-9])$/i;
                                if (re.test(document.getElementById('name').value)) {
                                    print_message(Error, "Invalid directory name", document.getElementById('name').value);
                                    return;
                                }


                                const new_dir = await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/make-directory${this.navigator.get_current_directory() ? '/' + this.navigator.get_current_directory() : ''}`,
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Accept': 'application/json',
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            name: ClientString.FromClient(document.getElementById('name').value),
                                            open_upload: false,
                                        })
                                    }));
                                if (new_dir && new_dir.id) {
                                    REPOS_BUILDER.filesystem.add_object(FilesystemObject.FromServerData(new_dir));
                                }
                                close_modal();
                            }
                        })
                        open_modal(make_directory, '500px', '250px', 'make-directory')
                    },
                    image: '/images/icons/icons8-add-folder-48.png'
                });

                if (navigator.clipboard_items && navigator.clipboard_items.length !== 0)
                    actions.push({
                        title: "Coller ici",
                        action: async () => {
                            await navigator.move_clipboard_to_parent(navigator.get_current_directory())
                        },
                        image: '/images/icons/icons8-paste-96.png'
                    })
                spawn_context_action(actions);
                event.preventDefault();
            }
    }

    /**
     * @param new_filter {ReposFilter}
     */
    set_filter(new_filter) {
        last_filter = new_filter;
        last_filter.set_name_filter(string_filter);
        last_filter.only_files_recursive(show_all_files);
        this.regen_content();
    }

    /**
     * @param text {string}
     */
    filter_text(text) {
        last_filter.set_name_filter(text)
        string_filter = text;
        this.regen_content();
    }

    get_filter() {
        return last_filter;
    }

    only_files_recursive() {
        last_filter.only_files_recursive(!last_filter._files_recursive);
        show_all_files = last_filter._files_recursive;
        this.regen_content();
    }

    destroy() {
        this.current_directory_listener.destroy();
    }

    directories_data() {
        const data = [];
        for (const object of this.objects)
            if (!object.data.is_regular_file)
                data.push(object.data);
        return data;
    }

    files_data() {
        const data = [];
        for (const object of this.objects)
            if (object.data.is_regular_file)
                data.push(object.data);
        return data;
    }

    regen_content() {
        this.objects = [];
        if (!this.viewport_container)
            return;
        this.viewport_container.innerHTML = '';

        const filtered_elements = last_filter.get_directory_content(this.navigator.get_current_directory());
        //@TODO : display more than 1000 items
        for (const object of filtered_elements.slice(0, 1000))
            this.objects.push({id: object.id, data: object});
        if (this.viewport_container)
            this.viewport_container.innerHTML = null;
        for (const object of this.directories_data())
            this._on_directory_added(object);
        for (const object of this.files_data())
            this._on_file_added(object);
    }

    /**
     * @param item {FilesystemObject}
     * @param element {HTMLElement}
     * @private
     */
    _add_element_decorations(item, element) {
        if (item.owner !== PAGE_CONTEXT.display_repos.owner) {
            const user_icon = document.createElement('img');
            user_icon.classList.add('user-icon');
            user_icon.src = '/images/icons/icons8-user-60.png';
            element.append(user_icon)
        }
        if (!item.is_regular_file) {
            if (item.open_upload) {
                const open_upload_icon = document.createElement('img');
                open_upload_icon.classList.add('open-upload-icon');
                open_upload_icon.src = '/images/icons/icons8-check-60.png';

                element.getElementsByTagName('img')[0].src = '/images/icons/icons8-opened-folder-96.png';
            }
        }
    }

    /**
     * @param directory {FilesystemObject}
     * @private
     */
    _on_directory_added(directory) {
        const dir_div = directory_hbs({item: directory}, {
            dblclicked: event => {
                if (is_touch_device())
                    return;
                if (!event.target.classList.contains('open-context-button') && !REPOS_BUILDER.is_looking_trash)
                    this.navigator.set_current_dir(directory.id);
            },
            clicked: event => {
                if (is_touch_device()) {
                    if (!this.navigator.is_touch_selection_mode && !REPOS_BUILDER.is_looking_trash)
                        this.navigator.set_current_dir(directory.id);
                    else
                        this.navigator.select_item(directory.id, event.shiftKey, event.ctrlKey);
                } else
                    this.navigator.select_item(directory.id, event.shiftKey, event.ctrlKey);
            },
            enter: () => this.navigator.set_hover_item(directory.id),
            leave: () => {
                if (this.navigator.get_hover_item() === directory.id)
                    this.navigator.set_hover_item(null);
            },
            context_menu: event => {
                if (is_touch_device()) {
                    if (this.navigator.is_touch_selection_mode) {
                        spawn_item_context_action(directory);
                        this.navigator.select_item(directory.id, event.shiftKey, event.ctrlKey, true);
                    } else {
                        this.navigator.enter_touch_selection_mode();
                        this.navigator.select_item(directory.id, event.shiftKey, event.ctrlKey);
                    }
                } else {
                    this.navigator.select_item(directory.id, event.shiftKey, event.ctrlKey, true);
                    spawn_item_context_action(directory);
                }
                event.preventDefault();
            },
        });
        this.entry_widgets.set(directory.id, dir_div)
        this._add_element_decorations(directory, dir_div);
        dir_div.object = directory;
        if (this.viewport_container)
            this.viewport_container.append(dir_div);
    }

    /**
     * @param file {FilesystemObject}
     * @private
     */
    _on_file_added(file) {
        let display_size = null;
        if (last_filter instanceof SizeFilter)
            display_size = humanFileSize(file.size);
        const file_div = file_hbs({item: file, display_size: display_size}, {
            dblclicked: event => {
                if (is_touch_device())
                    return;
                if (event.target.classList.contains('open-context-button'))
                    return;

                this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey, true);
                this.open_item_carousel();
            },
            clicked: event => {
                if (is_touch_device()) {
                    if (!this.navigator.is_touch_selection_mode) {
                        this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey, true);
                        this.open_item_carousel();
                    } else
                        this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey);
                } else {
                    this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey);
                }
            },
            enter: () => this.navigator.set_hover_item(file.id),
            leave: () => {
                if (this.navigator.get_hover_item() === file.id)
                    this.navigator.set_hover_item(null);
            },
            context_menu: event => {
                if (is_touch_device()) {
                    if (this.navigator.is_touch_selection_mode) {
                        spawn_item_context_action(file);
                        this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey, true);
                    } else {
                        this.navigator.enter_touch_selection_mode();
                        this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey);
                    }
                } else {
                    this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey, true);
                    spawn_item_context_action(file);
                }
                event.preventDefault();
            },
        });
        this.entry_widgets.set(file.id, file_div)
        this._add_element_decorations(file, file_div);
        file_div.object = file;
        this.viewport_container.append(file_div);
    }

    /**
     * @param item {number}
     * @private
     */
    _on_item_removed(item) {
        let widget = this.entry_widgets.get(item);
        if (widget)
            widget.remove();
        this.entry_widgets.delete(item);
        for (let i = 0; i < this.objects.length; ++i)
            if (this.objects[i].id === item)
                return this.objects.splice(i, 1);
    }

    /**
     * @param object {number|null}
     * @return {number|null}
     */
    get_item_index(object) {
        if (!object && this.objects.length !== 0)
            return null;
        if (this.objects.length === 0)
            return null;
        for (let i = 0; i < this.objects.length; ++i)
            if (this.objects[i].id === object)
                return i;
        return null;
    }

    /**
     * @param index {number|null}
     * @return {number|null}
     */
    get_item_at_index(index) {
        if (index >= this.objects.length || index < 0)
            return null;
        return this.objects[index].id;
    }

    /**
     * @param object {number}
     * @param only_files {boolean}
     * @return {number|null}
     */
    get_item_after(object, only_files = false) {
        const file_index = this.get_item_index(object);
        if (file_index === null)
            return this.objects.length !== 0 ? this.objects[0].id : null;
        for (let i = 0; i < this.objects.length; ++i) {
            const id = (i + file_index + 1) % this.objects.length;
            if (!only_files || this.objects[id].data.is_regular_file)
                return this.objects[id].id;
        }
        return null;
    }

    /**
     * @param object {number}
     * @param only_files {boolean}
     * @return {number|null}
     */
    get_item_before(object, only_files = false) {
        const file_index = this.get_item_index(object);
        if (file_index === null)
            return this.objects.length !== 0 ? this.objects[this.objects.length - 1].id : null;
        for (let i = this.objects.length - 1; i >= 0; --i) {
            const id = (i + file_index) % this.objects.length;
            if (!only_files || this.objects[id].data.is_regular_file)
                return this.objects[id].id;
        }
        return null;
    }

    open_item_carousel() {
        if (this.item_carousel) {
            this.item_carousel.close();
            this.item_carousel = null;
        }

        const container = Carousel.get_fullscreen_container();
        container.root.style.display = 'flex';
        const item_list = new CarouselList(this);
        item_list.build_visual(container.list_container)
        this.item_carousel = new Carousel(item_list, container.background_container, this.navigator.filesystem.get_object_data(this.navigator.last_selected_item));
        this.item_carousel.on_close = () => {
            container.root.style.display = 'none';
        }
    }

    close_carousel() {
        if (this.item_carousel)
            this.item_carousel.close();
        delete this.item_carousel;
        this.item_carousel = null;
    }
}

export {DirectoryContent}