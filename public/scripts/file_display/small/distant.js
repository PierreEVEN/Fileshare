import {get_mime_icon_path} from "../mime_utils";

function get(item) {
    const mime = item.mimetype.split('/');
    switch (mime[0]) {
        case 'video':
            return `<div class="item-small">
                            <img class="item-background" src="/file/thumbnail/?file=${item.id}" alt="fichier: '${item.name}" onError="this.onError = null; this.src='/images/icons/mime-icons/video.png'"/>
                            <img class="item-overlay" src="/images/icons/icons8-play-64.png" alt="play button">
                        </div>`
        case 'image':
        case 'application':
            switch (mime[1]) {
                case 'x-pdf':
                case 'pdf':
                    return `<img class="item-small" src="/file/thumbnail/?file=${item.id}" alt="fichier: ${item.name}" onError="this.onError = null; this.src='/images/icons/mime-icons/image.png'"/>`
            }
            break;
    }

    return `<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`;
}

export {get}