import {get_mime_icon_path} from "../mime_utils";

function get(item) {
    switch (item.mimetype.split('/')[0]) {
        case 'image':
            return `<img class="item-small" src="${URL.createObjectURL(item)}" alt="image: ${item.name}" onError="this.onError = null; this.src='/images/icons/mime-icons/image.png'"/>`
        case 'video':
            return `<video class="item-small" preload="auto" data-setup="{}" autoplay="false" preload="auto" height="100%" width="100%">
                        <source src="${URL.createObjectURL(item)}" type="${item.mimetype}">
                    </video>`
    }
    return `<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`;
}

export {get}