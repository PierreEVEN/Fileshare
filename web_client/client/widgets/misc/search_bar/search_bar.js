import {AppWidget} from "../../../src/app_widget";
import './option/search_bar_option'
import {Filter} from "../../../src/filter/filter";
import {StateSelection} from "../../../src/state/state_selection";
import {NavigableAppWidget} from "../../../src/utilities/navigable";
require('./search_bar.scss')

class SearchBar extends NavigableAppWidget {
    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.set_content(require('./search_bar.hbs'), {}, {
            search_changed: (event) => {
                const options = this.match_options(event.target.value);
                this.update_options(options);
            },
            keydown: (event) => {
                if (event.key === 'Enter') {
                    const options = this.match_options(event.target.value);
                    if (options.length > 0) {
                        this._add_option(options[0])
                    } else
                        this.apply_filter();
                }
            },
            search: () => {
                this.apply_filter();
            }
        });

        const pointer_down_event = e => {
            if (!e.target.closest('search-bar') && !e.target.closest('.search-bar-option-div'))
                this.update_options([]);
        };
        this._pointer_down_event = pointer_down_event;

        document.addEventListener('pointerdown', pointer_down_event)
    }

    disconnectedCallback() {
        document.removeEventListener('pointerdown', this._pointer_down_event);
    }

    list_filters() {
        const filters = new Map();
        for (const element of this.elements().search_bar.children) {
            if (element.tagName.toLowerCase() === 'search-bar-option')
                filters.set(element._data.title, element)
        }
        return filters;
    }

    update_options(option_list) {
        if (option_list.length === 0) {
            if (this._option_div) {
                this._option_div.remove();
                delete this._option_div;
            }
            return;
        }
        if (!this._option_div) {
            this._option_div = document.createElement('div');
            this._option_div.className = 'search-bar-option-div';
            const this_transform = this.getBoundingClientRect();
            this._option_div.style.left = `${this_transform.left}px`;
            this._option_div.style.top = `${this_transform.bottom}px`;
            document.body.append(this._option_div);
        }

        this._option_div.innerHTML = '';

        for (const data of option_list) {
            const option = document.createElement('button');
            const base = document.createElement('p');
            base.innerText = data.title + ": ";
            option.append(base);
            const value = document.createElement('p');
            value.innerText = data.value;
            option.append(value);
            option.onclick = () => {
                this._add_option(data)
            }

            this._option_div.append(option)
        }
    }

    _add_option(data) {
        this.elements().text.value = '';
        const children = this.elements().search_bar.children;
        this.elements().search_bar.insertBefore(document.createElement('search-bar-option').set_data(data), children[children.length - 1]);
        this.update_options([]);
    }

    async apply_filter() {
        const filter = new Filter();
        const state_repository = await this.get_app().state.get_current_repository();
        if (state_repository) {
            const item = this.get_app().state.get_current_item();
            filter.source(state_repository.id, item ? item.id : null);
        } else if (this.get_app().state.selection().filter) {
            const old_filter = this.get_app().state.selection().filter;
            filter._repositories = old_filter._repositories;
        } else {
            for (const repository of this.get_app().pool.loaded_repositories())
                filter.source(repository.id, null);
        }

        for (const [_, opt] of this.list_filters()) {
            opt.set(filter);
        }
        if (this.elements().text.value !== '')
            filter.name(this.elements().text.value);

        await this.get_app().state.select(new StateSelection().set_filter(filter));
    }

    match_options(text) {
        const filters = this.list_filters();
        const options = [];

        if ("de:".includes(text) && !filters.has("de")) {
            options.push({title: "de", value: "utilisateur", set: (filter, value) => filter.owner(value)});
        }
        if ("mime:".includes(text) && !filters.has("mime")) {
            options.push({title: "mime", value: "type de fichier", set: (filter, value) => filter.mime(value)});
        }
        if ("plus grand que:".includes(text) && !filters.has("plus grand que")) {
            options.push({title: "plus grand que", value: "taille", set: (filter, value) => filter.more_than(value)});
        }
        if ("plus petit que:".includes(text) && !filters.has("plus petit que")) {
            options.push({title: "plus petit que", value: "taille", set: (filter, value) => filter.less_than(value)});
        }

        return options;
    }
}

customElements.define('search-bar', SearchBar);