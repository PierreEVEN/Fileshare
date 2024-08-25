import {ReposFilter} from "./base_filter";

class SizeFilter extends ReposFilter {

    static ID = 'SizeFilter';

    get_directory_content(parent_directory) {
        const entries = this.lex_sort_entries(super.get_directory_content(parent_directory), this.reverse);
        return entries.directories.concat(entries.files.sort((a, b) => a.size < b.size || a.name.plain().localeCompare(b.name.plain())));
    }
}

export {SizeFilter};