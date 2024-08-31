import {spawn_context_action} from "../components/context_action.js";
import {close_modal, open_modal} from "../components/modal.js";
import {parse_fetch_result, print_message} from "../components/message_box.js";
import {REPOS_BUILDER} from "./repos_builder";
import {PAGE_CONTEXT, permissions} from "../../../common/tools/utils";
import {ClientString} from "../../../common/tools/client_string";
import {FilesystemObject} from "../../../common/tools/filesystem_v2";

const edit_dir_hbs = require('./menus/edit_directory.hbs')
const edit_file_hbs = require('./menus/edit_file.hbs')

async function spawn_item_context_action(item) {
    if (!PAGE_CONTEXT.display_repos)
        return;
    const actions = [];
    actions.push({
        title: "Partager",
        action: async () => {
            let url = `${location.origin}${PAGE_CONTEXT.repos_path()}/file/${item.id}`;
            await navigator.clipboard.writeText(url);
            print_message('info', 'Lien copié dans le presse - papier', url)
        },
        image: '/images/icons/icons8-url-96.png'
    });

    actions.push({
        title: "Télécharger",
        action: () => {
            window.open(`${PAGE_CONTEXT.repos_path()}/file/${item.id}`, '_blank').focus();
        },
        image: '/images/icons/icons8-download-96.png'
    });

    if (await permissions.can_user_edit_item(PAGE_CONTEXT.repos_path(), item.id)) {
        actions.push({
            title: "Modifier",
            action: () => {
                if (item.is_regular_file) {

                    const ext_split = item.name.plain().split('.');
                    const name = ext_split.length <= 1 ? item.name : ext_split[0];
                    const extension = ext_split.length <= 1 ? '' : ext_split[ext_split.length - 1];

                    open_modal(edit_file_hbs({
                            item: {
                                name: name,
                                extension: extension,
                                description: item.description
                            }
                        },
                        {
                            submit: async (e) => {
                                e.preventDefault();
                                const final_name = document.getElementById('name').value;
                                const final_extension = document.getElementById('extension').value;
                                const data = {
                                    name: ClientString.FromClient(final_name + (final_extension.length !== 0 ? `.${final_extension}` : '')),
                                    description: ClientString.FromClient(document.getElementById('description').value)
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
                                REPOS_BUILDER.filesystem.remove_object(item.id);
                                REPOS_BUILDER.filesystem.add_object(FilesystemObject.FromServerData(updated_item));

                                close_modal();
                            }
                        }));
                } else
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
                                REPOS_BUILDER.filesystem.remove_object(item.id);
                                REPOS_BUILDER.filesystem.add_object(FilesystemObject.FromServerData(updated_item));
                                close_modal();
                            }
                        }));
            },
            image: '/images/icons/icons8-edit-96.png'
        });
        actions.push({
            title: "Couper",
            action: () => {
                REPOS_BUILDER.cut_selection();
            },
            image: '/images/icons/icons8-cut-48.png'
        });
        if (REPOS_BUILDER.is_looking_trash) {
            actions.push({
                title: "Restaurer",
                action: async () => {
                    const result = await fetch(`${PAGE_CONTEXT.repos_path()}/restore-from-trash/`, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(Array.from(REPOS_BUILDER.navigator.selected_items))
                    });
                    if (result.status === 200) {
                        for (const elem of await result.json())
                            REPOS_BUILDER.filesystem.remove_object(elem);
                        REPOS_BUILDER.directory_content.regen_content();
                        print_message('info', `File restored`, `Successfully restored ${item.name}`);
                        close_modal();
                    } else if (result.status === 403) {
                        window.location = `/auth/signin/`;
                    } else {
                        print_message('error', `Failed to restore ${item.name}`, result.status);
                        close_modal();
                    }
                },
                image: '/images/icons/icons8-restore-96.png'
            });
            actions.push({
                title: "Supprimer définitivement",
                action: () => {
                    const div = document.createElement('div')
                    const p = document.createElement('p')
                    p.innerText = `Êtes vous sur de supprimer définitivement ${item.name} ?`;
                    div.append(p)
                    const no_button = document.createElement('button')
                    no_button.classList.add('cancel-button')
                    no_button.innerText = 'Non';
                    no_button.onclick = () => {
                        close_modal();
                    }
                    div.append(no_button)
                    const confirm_button = document.createElement('button')
                    confirm_button.innerText = 'Oui';
                    confirm_button.onclick = async () => {
                        const result = await fetch(`${PAGE_CONTEXT.repos_path()}/remove/`, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(Array.from(REPOS_BUILDER.navigator.selected_items))
                        });
                        if (result.status === 200) {
                            for (const elem of await result.json())
                                REPOS_BUILDER.filesystem.remove_object(elem);
                            REPOS_BUILDER.directory_content.regen_content();
                            print_message('info', `File removed`, `Successfully removed ${item.name}`);
                            close_modal();
                        } else if (result.status === 403) {
                            window.location = `/auth/signin/`;
                        } else {
                            print_message('error', `Failed to remove ${item.name}`, result.status);
                            close_modal();
                        }
                    }
                    div.append(confirm_button)
                    open_modal(div, '500px', '100px');
                },
                image: '/images/icons/icons8-trash-52.png'
            });
        } else {
            actions.push({
                title: "Déplacer dans la corbeille",
                action: () => {
                    const div = document.createElement('div')
                    const p = document.createElement('p')
                    p.innerText = `Êtes vous sur de vouloir déplacer ${item.name} dans la corbeille ?`;
                    div.append(p)
                    const no_button = document.createElement('button')
                    no_button.classList.add('cancel-button')
                    no_button.innerText = 'Non';
                    no_button.onclick = () => {
                        close_modal();
                    }
                    div.append(no_button)
                    const confirm_button = document.createElement('button')
                    confirm_button.innerText = 'Oui';
                    confirm_button.onclick = async () => {
                        await REPOS_BUILDER.move_selection_to_trash();
                    }
                    div.append(confirm_button)
                    open_modal(div, '500px', '100px');
                },
                image: '/images/icons/icons8-trash-52.png'
            })
        }
    }

    spawn_context_action(actions);
}

export {spawn_item_context_action}