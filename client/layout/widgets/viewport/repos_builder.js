import {spawn_item_context_action} from "./item_context_action.js";
import {parse_fetch_result, print_message} from "../components/message_box.js";
import {Filesystem, FilesystemObject} from "../../../common/tools/filesystem_v2.js";
import {Navigator} from "../../../common/tools/navigator.js";
import {PAGE_CONTEXT} from "../../../common/tools/utils";
import {LOCAL_USER} from "../../../common/tools/user";
import {PathBuilder} from "./path_builder";
import {close_modal, is_modal_open, open_modal} from "../components/modal";
import {spawn_context_action} from "../components/context_action";
import {ClientString} from "../../../common/tools/client_string";
import {CarouselList} from "../components/carousel/list/carousel_list";
import {Carousel} from "../components/carousel/carousel";

const directory_hbs = require('./directory.hbs');
const file_hbs = require('./file.hbs');


const make_directory_hbs = require('./menus/make_directory.hbs')

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

        /**
         * @type {ObjectListener}
         */
        this.current_directory_listener = navigator.filesystem.create_listener(navigator.get_current_directory());
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

        this.navigator.bind_on_select_item((item, should_select) => {
            const widget = this.entry_widgets.get(item)
            if (widget) {
                if (should_select) {
                    widget.classList.add("selected");
                    widget.scrollIntoView({behavior: "smooth", block: "nearest" +
                            "", inline: "nearest"});
                } else {
                    widget.classList.remove("selected");
                }
            }
        })

        this.regen_content();
        if (this.viewport_container)
            this.viewport_container.oncontextmenu = event => {

                const actions = [];
                actions.push({
                    title: "Nouveau Dossier",
                    action: async () => {
                        const make_directory = make_directory_hbs({}, {
                            mkdir: async () => {
                                const re = /[<>:"\/\\|?*\x00-\x1F]|^(?:aux|con|clock\$|nul|prn|com[1-9]|lpt[1-9])$/i;
                                if(re.test(document.getElementById('name').value)) {
                                    print_message(Error, "Invalid directory name", document.getElementById('name').value);
                                    return;
                                }


                                await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/make-directory${this.navigator.get_current_directory() ? '/' + this.navigator.get_current_directory().id : ''}`,
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
                                close_modal();
                            }
                        })
                        open_modal(make_directory, '500px', '250px', 'make-directory')
                    },
                    image: '/images/icons/icons8-add-folder-48.png'
                });

                spawn_context_action(actions);
                event.preventDefault();
            }
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
        for (const object of this.navigator.filesystem.get_objects_in_directory(this.navigator.get_current_directory()))
            this.objects.push({id: object, data: this.navigator.filesystem.get_object_data(object)});
        if (this.viewport_container)
            this.viewport_container.innerHTML = null;
        for (const object of this.directories_data())
            this._on_directory_added(object);
        for (const object of this.files_data())
            this._on_file_added(object);
    }

    /**
     * @param directory {FilesystemObject}
     * @private
     */
    _on_directory_added(directory) {
        const dir_div = directory_hbs({item: directory}, {
            dblclicked: event => {
                if (!event.target.classList.contains('open-context-button'))
                    this.navigator.set_current_dir(directory.id);
            },
            clicked: event => {
                if (window.matchMedia("(pointer: coarse)").matches)
                    this.navigator.set_current_dir(directory.id);
                else
                    this.navigator.select_item(directory.id, event.shiftKey, event.ctrlKey);
            },
            enter: () => this.navigator.set_hover_item(directory.id),
            leave: () => {
                if (this.navigator.get_hover_item() === directory.id)
                    this.navigator.set_hover_item(null);
            },
            context_menu: event => {
                spawn_item_context_action(directory);
                event.preventDefault();
            },
        });
        this.entry_widgets.set(directory.id, dir_div)
        dir_div.object = directory;
        if (this.viewport_container)
            this.viewport_container.append(dir_div);
    }

    /**
     * @param file {FilesystemObject}
     * @private
     */
    _on_file_added(file) {
        const file_div = file_hbs({item: file}, {
            dblclicked: event => {
                if (event.target.classList.contains('open-context-button'))
                    return;

                this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey, true);
                this.open_item_carousel();
            },
            clicked: event => {
                if (window.matchMedia("(pointer: coarse)").matches) {
                    this.navigator.select_item(file.id, event.shiftKey, event.ctrlKey, true);
                    this.open_item_carousel();
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
                spawn_item_context_action(file);
                event.preventDefault();
            },
        });
        this.entry_widgets.set(file.id, file_div)
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
        const item_list = new CarouselList(this.navigator);
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

class ReposBuilder {
    constructor(repo) {
        this.repo = repo;

        /**
         * @type {Filesystem}
         */
        this.filesystem = new Filesystem(this.repo.display_name);

        /**
         * @type {Navigator}
         */
        this.navigator = new Navigator(this.filesystem);

        /**
         * @type {PathBuilder}
         */
        this.path_builder = new PathBuilder(this.navigator);

        /**
         * @type {DirectoryContent}
         */
        this.directory_content = new DirectoryContent(this.navigator);

        this.navigator.on_changed_dir((new_dir) => {
            this.directory_content.destroy();

            this.directory_content = new DirectoryContent(this.navigator);

            // Show directory or repo description
            const dir_data = this.filesystem.get_object_data(new_dir)
            const description = new_dir && dir_data && dir_data.parent_item !== null ? dir_data.description.plain() : PAGE_CONTEXT.display_repos.description.plain();
            if (description && description !== '' && description !== 'null') {
                import('../../../embed_viewers/custom_elements/document/showdown_loader').then(showdown => {
                    const directory_description = document.getElementById('directory-description')
                    if (directory_description) {
                        directory_description.innerHTML = showdown.convert_text(description)
                        directory_description.style.padding = '20px';
                    }
                })
            } else {
                const directory_description = document.getElementById('directory-description')
                if (directory_description) {
                    directory_description.innerText = '';
                    directory_description.style.padding = '0';
                }
            }
        })

        this.fetch_repos_content().then(() => {
            this.navigator.set_current_dir(this.filesystem.get_object_from_path(PAGE_CONTEXT.request_path.plain()));
        })

        window.addEventListener('popstate', function (event) {
            if (!event.state)
                return;

            const dir = this.filesystem.get_object_from_path(event.state)
            this.navigator.set_current_dir(dir);
        }, false);

        document.addEventListener('keydown', (event) => {
            if ((event.key === 'Backspace' || event.key === 'Escape')) {
                if (is_modal_open()) {
                    if (event.key === 'Escape')
                        close_modal();
                    return;
                }
                if (this.directory_content.item_carousel) {
                    this.directory_content.close_carousel();
                } else {
                    const current_data = this.filesystem.get_object_data(this.navigator.get_current_directory());
                    if (current_data) {
                        this.navigator.set_current_dir(current_data.parent_item)
                        this.navigator.select_item(current_data.id, false, false);
                    }
                }
            }
            if (event.key === 'ArrowRight') {
                if (is_modal_open() || (this.directory_content && this.directory_content.item_carousel))
                    return;
                this.select_next_element(event);
            }
            if (event.key === 'ArrowLeft') {
                if (is_modal_open() || (this.directory_content && this.directory_content.item_carousel))
                    return;
                this.select_previous_element(event);
            }
            if (event.key === 'ArrowUp') {
                if (is_modal_open() || (this.directory_content && this.directory_content.item_carousel))
                    return;
                const item_per_row = this.directory_content.viewport_container.offsetWidth / 120;
                for (let i = 1; i < item_per_row; ++i)
                    this.select_previous_element(event);
            }
            if (event.key === 'ArrowDown') {
                if (is_modal_open() || (this.directory_content && this.directory_content.item_carousel))
                    return;
                const item_per_row = this.directory_content.viewport_container.offsetWidth / 120;
                for (let i = 1; i < item_per_row; ++i)
                    this.select_next_element(event);
            }
            if (event.key === 'Enter') {
                if (is_modal_open())
                    return;
                const current_data = this.filesystem.get_object_data(this.navigator.last_selected_item);
                if (current_data) {
                    if (current_data.is_regular_file) {
                        this.directory_content.open_item_carousel();
                    } else
                        this.navigator.set_current_dir(current_data.id);
                }
            }
        }, false);
    }

    async fetch_repos_content() {
        const time_a = performance.now()
        this.filesystem.clear();
        await fetch(`${PAGE_CONTEXT.repos_path()}/content/`, {
            headers: {
                'content-authtoken': LOCAL_USER.get_token(),
                'accept': 'application/json',
            },
        })
            .then(async (response) => await parse_fetch_result(response))
            .then((json) => {
                const time_b = performance.now()

                for (const item of json)
                    this.filesystem.add_object(FilesystemObject.FromServerData(item));
                const time_c = performance.now()

                console.log(`Retrieved repo content. Fetch : ${time_b - time_a}ms, Display : ${time_c - time_b}ms`)
            });
    }

    select_previous_element(event) {
        this.navigator.select_item(this.directory_content.get_item_before(this.navigator.last_selected_item, !!this.directory_content.item_carousel), event.shiftKey, event.ctrlKey);
    }

    select_next_element(event) {
        this.navigator.select_item(this.directory_content.get_item_after(this.navigator.last_selected_item, !!this.directory_content.item_carousel), event.shiftKey, event.ctrlKey);
    }
}

const REPOS_BUILDER = PAGE_CONTEXT.display_repos ? new ReposBuilder(PAGE_CONTEXT.display_repos) : null;

export {REPOS_BUILDER}