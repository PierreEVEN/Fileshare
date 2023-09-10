import {get_mime_icon_path} from "../mime_utils";
require('./document-embed.js')
require('./pdf-viewer.js')


function get(item) {
    const url = `/file/?file=${item.id}`;
    const mimetype = item.mimetype.split('/');
    switch (mimetype[0]) {
        case 'image':
            return `<img class="item-large" src="${url}" alt="image: ${item.name}" onError="this.onError = null; this.src='/images/icons/mime-icons/image.png'"/>`
        case 'video':
            return `<video class="item-large video-js" preload="auto" data-setup="{}" autoplay="true" preload="auto" height="100%" width="100%">
                        <source src="${url}" type="${item.mimetype}">
                    </video>`
        case 'audio':
            return `<audio controls="true" src="/file/?file=${item.id}"></audio>`
        case 'application':
            switch (mimetype[1]) {
                case 'x-pdf':
                case 'pdf':
                    return `<object data="${url}" type="application/pdf" width="100%" height="100%">
                                <pdf-embed src="${url}"></pdf-embed>
                            </object>`
                case 'json':
                case 'javascript':
                case 'x-javascript':
                    return `<document-embed src="/file?file=${item.id}"></document-embed>`
            }
            break;
        case 'text':
            return `<document-embed src="/file?file=${item.id}"></document-embed>`
    }

    return `<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`;
}

export {get}