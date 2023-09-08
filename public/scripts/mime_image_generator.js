import Handlebars from "handlebars";
import {does_mimetype_has_thumbnail, get_mime_icon_path} from "./mime_utils";

function mime_image_generator_helper(item, is_small) {
    // DEFAULT CASE
    let res = "<p>Undefined object</p>>";

    if (item.is_directory) {
        res = `<img src="/images/icons/icons8-folder-96.png" alt="dossier: ${item.name}">`
    }

    // CASE : IS STANDARD FILE
    else if (item.is_file) {

        // Default mime icon
        res = '<img class="' + (is_small ? 'item-small' : 'item-large') + '" src="' + get_mime_icon_path(item.mimetype) + '" alt="fichier: ' + item.name + '"/>';

        // Distant repos
        if (item.id) {
            // We want a thumbnail
            if (is_small && does_mimetype_has_thumbnail(item.mimetype)) {
                // Add play button
                if (item.mimetype && item.mimetype.startsWith('video'))
                    res = '<div class="item-small">\\n' +
                        '<img class="item-background" src="/file/thumbnail/?file=' + item.id + '" alt="fichier: ' + item.name + '" onError="this.onError = null; this.src=' + '/images/icons/mime-icons/image.png' + '"/>\\n' +
                        '<img class="item-overlay" src="/images/icons/icons8-play-64.png" alt="play button">\\n' +
                        '</div>'
                else
                    res = '<img class="item-small" src="/file/thumbnail/?file=' + item.id + '" alt="fichier: ' + item.name + '" onError="this.onError = null; this.src=' + '/images/icons/mime-icons/image.png' + '"/>'
            }

            // Handle cases manually
            if (!is_small) {
                switch (item.mimetype.split('/')[0]) {
                    case 'image':
                        res = '<img class="item-large" src="/file/?file=' + item.id + '" alt="image: ' + item.name + '" onError="this.onError = null; this.src=' + '/images/icons/mime-icons/image.png' + '"/>'
                        break;
                    case 'video':
                        res = '<video class="item-large video-js" preload="auto" data-setup="{}" autoplay="true" preload="auto" height="100%" width="100%"><source src="/file/?file=' + item.id + '" type="' + item.mimetype + '"></video>'
                        break;
                    case 'audio':
                        res = '<audio controls="true" src="/file/?file=' + item.id + '"></audio>'
                        break;
                }
            }
        }
    }
    return new Handlebars.SafeString(res);
}

Handlebars.registerHelper("item_image", (options) => mime_image_generator_helper(options, false));
Handlebars.registerHelper("item_thumbnail", (options) => mime_image_generator_helper(options, true));