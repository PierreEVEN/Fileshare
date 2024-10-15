import {ReposFilter} from "./base_filter";

class DateFilter extends ReposFilter {
    reverse_filter() {
        this.reverse = true;
        return this;
    }

    get_directory_content(parent_directory) {
        const entries = this.lex_sort_entries(super.get_directory_content(parent_directory), this.reverse);
        if (this.reverse)
            return entries.directories.concat(entries.files.sort((a, b) => b.timestamp > a.timestamp || b.name.plain().localeCompare(a.name.plain())));
        else
            return entries.directories.concat(entries.files.sort((a, b) => a.timestamp > b.timestamp || a.name.plain().localeCompare(b.name.plain())));
    }
}

export {DateFilter};