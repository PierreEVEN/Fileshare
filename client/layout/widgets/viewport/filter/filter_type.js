import {ReposFilter} from "./base_filter";

class TypeFilter extends ReposFilter {

    get_directory_content(parent_directory) {
        const entries = this.lex_sort_entries(super.get_directory_content(parent_directory), this.reverse);
        return entries.directories.concat(entries.files.sort((a, b) => a.mimetype.plain().localeCompare(b.mimetype.plain()) || a.name.plain().localeCompare(b.name.plain())));
    }
}

export {TypeFilter};