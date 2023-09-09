const Handlebars = require('handlebars');

function is_valid(mimetype) {
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

function get_mime_icon_path(mimetype) {
    if (!is_valid(mimetype))
        return '/images/icons/no-mime-icon.png';

    const [mime_left, mime_right] = mimetype.split('/');

    const mime_icons = Handlebars.get_mime_icons();
    const mime_category = mime_icons[mime_left];
    if (!mime_category)
        return '/images/icons/no-mime-icon.png';

    if (mime_category.content) {
        const mime_type = mime_category.content[mime_right];
        if (!mime_type)
            return mime_category.base;
        return mime_type;
    }

    return mime_category.base;
}

export {get_mime_icon_path}