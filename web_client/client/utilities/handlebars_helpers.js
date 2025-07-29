import Handlebars from "handlebars";
import {get_mime_icon_path, is_mimetype_valid, UNDEFINED_MIME_STRING} from "./mime_utils";

/* ################## HELPER {ITEM_THUMBNAIL} ################## */
const get_item_thumbnail = require('./get_item_thumbnail')
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
        else {
            return new Handlebars.SafeString(get_item_thumbnail.from_local_path(item));
        }
    }
    // CASE : IS DIRECTORY
    else {
        return new Handlebars.SafeString(`<img src="/public/images/icons/icons8-folder-96.png" alt="dossier: ${item.name}">`)
    }
});

/* ################## HELPER {TYPEICON} ################## */
Handlebars.registerHelper("typeicon", function (options) {
    return new Handlebars.SafeString(`<img class='typeicon' alt='typeicon' src="${get_mime_icon_path(options)}">`);
});

/* ################## HELPER {CTX} ################## */
Handlebars.registerHelper("ctx", function (options) {
    if (!this['__hbs_cid'])
        return console.error('This template was not instanced with a context');
    return new Handlebars.SafeString("console.assert(document.__hbs_cl.ctx[" + this['__hbs_cid'] + "], 'no context provided for : " + options + " on object :', this, '\\n Available contexts :', document.__hbs_cl.ctx); document.__hbs_cl.ctx[" + this['__hbs_cid'] + "]." + options);
});

/* ################## HELPER {OBJECT} ################## */
Handlebars.registerHelper("object", function (options) {
    if (!this['c_id'])
       return console.error('This template was not instanced with an object container id');

    let name = '__object_id_' + this.c_id + "_" + options + "__";
    document.__hbs_cl.c[this.c_id].set(options, name);
    return new Handlebars.SafeString('__custom-id="' + name + '"');
});