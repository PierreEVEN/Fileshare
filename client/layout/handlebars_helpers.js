import Handlebars from "handlebars";
import {is_mimetype_valid, UNDEFINED_MIME_STRING} from "../common/tools/mime_utils";

/* ################## HELPER {ITEM_THUMBNAIL} ################## */
const get_item_thumbnail = require('../common/tools/get_item_thumbnail')
Handlebars.registerHelper("item_thumbnail", (item) => {
    // CASE : IS DIRECTORY
    if (item.is_directory) {
        return new Handlebars.SafeString(`<img src="/images/icons/icons8-folder-96.png" alt="dossier: ${item.name}">`)
    }
    // CASE : IS STANDARD FILE
    if (item.is_file) {
        if (!is_mimetype_valid(item.mimetype))
            return new Handlebars.SafeString(UNDEFINED_MIME_STRING);
        // Distant repos
        if (item.id) {
            return new Handlebars.SafeString(get_item_thumbnail.from_distant_repos(item));
        }
        // Filesystem file
        else if (item.lastModified) {
            return new Handlebars.SafeString(get_item_thumbnail.from_local_path(item));
        }
    }
});


/* ################## HELPER {CTX} ################## */
Handlebars.registerHelper("ctx", function (options) {
    if (!this['__handlebar_ctx_id'])
        return console.error('This template was not instanced with a context');
    return new Handlebars.SafeString("console.assert(window.__handlebar_custom_loader.__registered_ctx[" + this['__handlebar_ctx_id'] + "], 'no context provided for : " + options + "', this); window.__handlebar_custom_loader.__registered_ctx[" + this['__handlebar_ctx_id'] + "]." + options);
});

/* ################## HELPER {MARKDOWN} ################## */
Handlebars.registerHelper("markdown", function (options) {
    const converter = new (require('showdown')).Converter();
    return new Handlebars.SafeString(converter.makeHtml(options));
});
