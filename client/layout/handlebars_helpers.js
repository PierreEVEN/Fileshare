import Handlebars from "handlebars";
import {get_mime_icon_path, is_mimetype_valid, UNDEFINED_MIME_STRING} from "../common/tools/mime_utils";

/* ################## HELPER {ITEM_THUMBNAIL} ################## */
const get_item_thumbnail = require('../common/tools/get_item_thumbnail')
Handlebars.registerHelper("item_thumbnail", (item) => {

    // CASE : IS STANDARD FILE
    if (item.is_regular_file) {
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
    // CASE : IS DIRECTORY
    else {
        return new Handlebars.SafeString(`<img src="/images/icons/icons8-folder-96.png" alt="dossier: ${item.name}">`)
    }
});

/* ################## HELPER {CTX} ################## */
Handlebars.registerHelper("typeicon", function (options) {
    return new Handlebars.SafeString(`<img class='typeicon' alt='typeicon' src="${get_mime_icon_path(options)}">`);
});

/* ################## HELPER {CTX} ################## */
Handlebars.registerHelper("ctx", function (options) {
    if (!this['__handlebar_ctx_id'])
        return console.error('This template was not instanced with a context');
    return new Handlebars.SafeString("console.assert(document.__handlebar_custom_loader.__registered_ctx[" + this['__handlebar_ctx_id'] + "], 'no context provided for : " + options + " on object :', this, '\\n Available contexts :', document.__handlebar_custom_loader.__registered_ctx); document.__handlebar_custom_loader.__registered_ctx[" + this['__handlebar_ctx_id'] + "]." + options);
});

/* ################## HELPER {MARKDOWN} ################## */
Handlebars.registerHelper("markdown", function (options) {
    const converter = new (require('showdown')).Converter();
    return new Handlebars.SafeString(converter.makeHtml(options));
});
