import Handlebars from "handlebars";
import {get_mime_icon_path, is_mimetype_valid} from "../common/tools/mime_utils";

require('./custom_elements/document/code')
require('./custom_elements/document/markdown')
require('./custom_elements/lazy_image/lazy_image')
require('./custom_elements/pdf_viewer/pdf-viewer')

    function mime_image_generator_helper_big(item) {
    // CASE : IS DIRECTORY
    if (!item.is_regular_file) {
        return new Handlebars.SafeString(`<img src="/images/icons/icons8-folder-96.png" alt="dossier: ${item.name}">`)
    }
    // CASE : IS STANDARD FILE
    else {
        if (!is_mimetype_valid(item.mimetype))
            return new Handlebars.SafeString(`<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`);
        // Distant repos
        if (item.id) {
            return new Handlebars.SafeString(require("./distant_repos").get(item));
        }
        // Filesystem file
        else if (item.lastModified) {
            return new Handlebars.SafeString(`<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`);
        }
    }
}

Handlebars.registerHelper("item_image", (options) => mime_image_generator_helper_big(options));

console.info('Loaded viewers.js');