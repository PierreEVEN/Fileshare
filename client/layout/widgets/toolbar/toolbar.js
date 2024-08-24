const toolbar_menu_hbs = require('./toolbar_menu.hbs')
const {print_message, parse_fetch_result} = require("../components/message_box");
const {PAGE_CONTEXT, humanFileSize, permissions} = require("../../../common/tools/utils");
const {spawn_context_action} = require("../components/context_action");
const {ClientString} = require("../../../common/tools/client_string");
const {open_modal, close_modal} = require("../components/modal");
const {FilesystemObject} = require("../../../common/tools/filesystem_v2");

const edit_dir_hbs = require('../viewport/menus/edit_directory.hbs')

class Toolbar {

    constructor(directory_content) {
        this.directory_content = directory_content;

        this.directory_content.navigator.on_changed_dir(async (new_dir) => {
            await this.update_path(new_dir)
        })

        const tool_buttons = document.getElementById('viewport_toolbar');
        const menu = toolbar_menu_hbs({}, {
            download: () => {
                window.open(`${PAGE_CONTEXT.repos_path()}/file${directory_content.navigator.current_directory ? "/" + directory_content.navigator.current_directory : ''}`, '_blank').focus();
            },
            search: () => {
                this.switch_search_mode(true);
            },
            more: async () => {

                const actions = [];
                if (this.directory_content.navigator.clipboard_items && this.directory_content.navigator.clipboard_items.length !== 0)
                    actions.push({
                        title: "Coller ici",
                        action: async () => {
                            await this.directory_content.navigator.move_clipboard_to_parent(this.directory_content.navigator.get_current_directory())
                        },
                        image: '/images/icons/icons8-paste-96.png'
                    });
                actions.push({
                    title: "Trier par ...",
                    action: async () => {
                        print_message("Erreur", 'Fonction indisponible', "La fonction de tri n'est pas encore disponible");
                    },
                    image: '/images/icons/icons8-sort-100.png'
                });
                if (this.directory_content.navigator.current_directory && await permissions.can_user_edit_item(PAGE_CONTEXT.repos_path(), this.directory_content.navigator.current_directory)) {
                    actions.push({
                        title: "Modifier le dossier",
                        action: async () => {
                            const item = this.directory_content.navigator.filesystem.get_object_data(this.directory_content.navigator.current_directory);
                            open_modal(edit_dir_hbs({item: item},
                                {
                                    submit: async (e) => {
                                        e.preventDefault();
                                        const data = {
                                            name: ClientString.FromClient(document.getElementById('name').value),
                                            description: ClientString.FromClient(document.getElementById('description').value),
                                            open_upload: document.getElementById('open_upload').checked,
                                        }
                                        const updated_item = await parse_fetch_result(await fetch(`${PAGE_CONTEXT.repos_path()}/update/${item.id}`,
                                            {
                                                method: 'POST',
                                                headers: {
                                                    'Accept': 'application/json',
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify(data)
                                            }));
                                        this.directory_content.navigator.filesystem.remove_object(item.id);
                                        this.directory_content.navigator.filesystem.add_object(FilesystemObject.FromServerData(updated_item));
                                        close_modal();
                                    }
                                }));
                        },
                        image: '/images/icons/icons8-edit-96.png'
                    });
                }
                actions.push({
                    title: "Corbeille",
                    action: async () => {
                        print_message("Erreur", 'Fonction indisponible', "La corbeille n'est pas accessible pour le moment");
                    },
                    image: '/images/icons/icons8-trash-96.png'
                });
                spawn_context_action(actions);
            },
            update_search: (e) => {
                this.switch_search_mode(true);
                print_message('Erreur', 'Fonction indisponible', 'La fonction "recherche" n\'est pas encore disponible');
            }
        })
        tool_buttons.append(menu);
    }

    async update_path(new_dir) {

        const current_path = document.getElementById('current-path');

        const content_text = document.getElementById('toolbar-stats');
        const stats = this.directory_content.navigator.filesystem.get_object_content_stats(new_dir);
        content_text.innerText = `${humanFileSize(stats.size)} / ${stats.count} fichiers`

        current_path.innerHTML = '';

        const button = document.createElement('button')
        button.innerText = this.directory_content.navigator.filesystem.name.plain();
        button.onclick = () => {
            this.directory_content.navigator.set_current_dir(null);
        }
        current_path.append(button);

        const separator = document.createElement('p')
        separator.innerText = ':'
        current_path.append(separator);

        for (const dir of this.directory_content.navigator.filesystem.make_path_to_object(new_dir)) {
            const dir_data = this.directory_content.navigator.filesystem.get_object_data(dir);
            if (dir_data.parent_item) {
                // Add separator between directories
                const separator = document.createElement('p')
                separator.innerText = '>'
                current_path.append(separator);
            }
            // Add button for each directory of the current path
            const button = document.createElement('button')
            button.innerText = dir_data.name.toString();
            button.onclick = () => {
                this.directory_content.navigator.set_current_dir(dir);
            }
            current_path.append(button);
        }
    }

    switch_search_mode(enabled) {
        const search_button = document.getElementById('toolbar-search');
        const content_text = document.getElementById('toolbar-stats');
        const search_text = document.getElementById('toolbar-search-text');
        if (enabled) {
            content_text.style.width = '0';
            search_text.style.display = 'flex';
            search_button.style.pointerEvents = 'none';
            search_text.focus();

            if (this.search_handle)
                clearTimeout(this.search_handle);
            this.search_handle = setTimeout(() => {
                this.switch_search_mode(false);
            }, 5000);
        } else {
            content_text.style.width = 'auto';
            search_text.style.display = 'none';
            search_button.style.pointerEvents = 'unset';
        }
    }
}

module.exports = {Toolbar};