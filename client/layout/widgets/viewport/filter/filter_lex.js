import {ReposFilter} from "./base_filter";

class LexicographicFilter extends ReposFilter {

    reverse_filter() {
        this.reverse = true;
        return this;
    }

    get_directory_content(parent_directory) {
        const entries = this.lex_sort_entries(super.get_directory_content(parent_directory), this.reverse);
        return entries.directories.concat(entries.files);
    }
}

export {LexicographicFilter};