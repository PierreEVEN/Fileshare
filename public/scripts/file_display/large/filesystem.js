import {get_mime_icon_path} from "../mime_utils";

function get(item) {
    return `<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`;
}

export {get}