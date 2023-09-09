import Handlebars from "handlebars";
import {get_mime_icon_path, is_valid} from "./mime_utils";

const large_distant = require('./large/distant')
const large_filesystem = require('./large/filesystem')
const small_distant = require('./small/distant')
const small_filesystem = require('./small/filesystem')

function mime_image_generator_helper(item, is_small) {
    // CASE : IS DIRECTORY
    if (item.is_directory) {
        return new Handlebars.SafeString(`<img src="/images/icons/icons8-folder-96.png" alt="dossier: ${item.name}">`)
    }
    // CASE : IS STANDARD FILE
    if (item.is_file) {
        if (!is_valid(item.mimetype))
            return new Handlebars.SafeString(`<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`);
        // Distant repos
        if (item.id) {
            if (is_small)
                return new Handlebars.SafeString(small_distant.get(item));
            else
                return new Handlebars.SafeString(large_distant.get(item));
        }
        // Filesystem file
        else if (item.lastModified) {
            if (is_small)
                return new Handlebars.SafeString(small_filesystem.get(item));
            else
                return new Handlebars.SafeString(large_filesystem.get(item));
        }
    }
}

Handlebars.registerHelper("item_image", (options) => mime_image_generator_helper(options, false));
Handlebars.registerHelper("item_thumbnail", (options) => mime_image_generator_helper(options, true));