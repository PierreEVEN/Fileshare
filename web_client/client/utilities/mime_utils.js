const Handlebars = require('handlebars');

/**
 * @param mimetype {string}
 * @return {string}
 */
function get_mime_alias(mimetype) {
    switch (mimetype) {
        case 'application/x-zip':
        case 'application/x-zip-compressed':
            return 'application/zip';
        case 'text/javascript':
        case 'text/x-javascript':
        case 'application/x-javascript':
            return 'application/javascript';
        case 'text/jade':
        case 'text/pug':
            return 'text/template';
    }
    return mimetype;
}

/**
 * @param mimetype {string}
 * @return {boolean}
 */
function is_mimetype_valid(mimetype) {
    if (!mimetype)
        return false;

    switch (mimetype) {
        case '':
        case 'undefined':
        case 'null':
            return false;
    }

    return true;
}

/**
 * @param mimetype {string}
 * @return {string}
 */
function get_mime_icon_path(mimetype) {
    if (!is_mimetype_valid(mimetype))
        return '/public/images/icons/no-mime-icon.png';

    const [mime_left, mime_right] = get_mime_alias(mimetype).split('/');

    const mime_icons = Handlebars.get_mime_icons();
    const mime_category = mime_icons[mime_left];
    if (!mime_category)
        return '/public/images/icons/no-mime-icon.png';

    if (mime_category.content) {
        const mime_type = mime_category.content[mime_right];
        if (!mime_type)
            return mime_category.base;
        return mime_type;
    }

    return mime_category.base;
}

const UNDEFINED_MIME_STRING = `<img class="item-small" src="/public/images/icons/no-mime-icon.png" alt="undefined-type"/>`;

export {get_mime_icon_path, is_mimetype_valid, UNDEFINED_MIME_STRING}