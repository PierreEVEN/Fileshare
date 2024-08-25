import {parse_fetch_result} from "../components/message_box.js";
import {Filesystem, FilesystemObject} from "../../../common/tools/filesystem_v2.js";
import {Navigator} from "../../../common/tools/navigator.js";
import {PAGE_CONTEXT, permissions} from "../../../common/tools/utils";
import {LOCAL_USER} from "../../../common/tools/user";
import {close_modal, is_modal_open} from "../components/modal";
import {DirectoryContent} from "./directory_content";
import {Toolbar} from "../toolbar/toolbar";

require('./item.scss')

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
         * @type {DirectoryContent}
         */
        this.directory_content = new DirectoryContent(this.navigator);

        /**
         * @type {Toolbar}
         */
        this.path_builder = new Toolbar(this.directory_content);

        this.navigator.on_changed_dir(async (new_dir) => {
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
            const upload_button = document.getElementById('upload-button');
            if (upload_button)
                upload_button.remove();

            if ((await permissions.can_user_upload_to_directory(PAGE_CONTEXT.repos_path(), new_dir)) || await permissions.can_user_upload_to_repos(PAGE_CONTEXT.repos_path())) {
                const upload_button = document.createElement('button');
                upload_button.onclick = () => upload.open_or_update_modal();
                upload_button.innerText = '+';
                upload_button.classList.add('plus-button');
                const upload_button_container = document.createElement('div');
                upload_button_container.id = 'upload-button';
                upload_button_container.append(upload_button);
                document.getElementById('file-list-box').append(upload_button_container);

                window.addEventListener('resize', (e) => {
                    console.log(upload_button.parentElement.offsetWidth);
                    upload_button_container.style.width = upload_button_container.parentElement.offsetWidth + 'px';
                    upload_button_container.style.height = upload_button_container.parentElement.offsetHeight + 'px';
                })
                upload_button_container.style.width = upload_button_container.parentElement.offsetWidth + 'px';
                upload_button_container.style.height = upload_button_container.parentElement.offsetHeight + 'px';
            }
        })

        this.fetch_repos_content(false).then(async () => {
            this.navigator.set_current_dir(this.filesystem.get_object_from_path(PAGE_CONTEXT.request_path.plain()));
        })

        const this_ref = this;
        window.addEventListener('popstate', (event) => {
            if (is_modal_open()) {
                close_modal();
                history.pushState(this_ref.navigator.current_directory, "", `${PAGE_CONTEXT.repos_path()}/tree${this_ref.navigator.get_string_path_to_directory(this_ref.navigator.current_directory)}`);
                return;
            }
            if (this.directory_content.item_carousel) {
                this.directory_content.close_carousel();
                console.log(window.location)
                history.pushState(this_ref.navigator.current_directory, "", `${PAGE_CONTEXT.repos_path()}/tree${this_ref.navigator.get_string_path_to_directory(this_ref.navigator.current_directory)}`);
                return;
            }
            this_ref.navigator.set_current_dir(event.state, true);
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

        LOCAL_USER.push_last_repos(this.repo.id);
    }

    async fetch_repos_content(is_trash = false) {
        const time_a = performance.now()
        this.filesystem.clear();
        await fetch(`${PAGE_CONTEXT.repos_path()}/${is_trash ? "trash" : "content"}/`, {
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

                console.info(`Retrieved repo content. Fetch : ${time_b - time_a}ms, Display : ${time_c - time_b}ms`)
            });
    }

    select_previous_element(event) {
        this.navigator.select_item(this.directory_content.get_item_before(this.navigator.last_selected_item, !!this.directory_content.item_carousel), event.shiftKey, event.ctrlKey);
    }

    select_next_element(event) {
        this.navigator.select_item(this.directory_content.get_item_after(this.navigator.last_selected_item, !!this.directory_content.item_carousel), event.shiftKey, event.ctrlKey);
    }

    async go_to_trash() {
        this.is_looking_trash = true;
        await this.fetch_repos_content(true);
        this.directory_content.regen_content();
    }

    async exit_trash() {
        this.is_looking_trash = false;
        await this.fetch_repos_content(false);
        this.directory_content.regen_content();
    }
}

const REPOS_BUILDER = PAGE_CONTEXT.display_repos ? new ReposBuilder(PAGE_CONTEXT.display_repos) : null;

export {REPOS_BUILDER}