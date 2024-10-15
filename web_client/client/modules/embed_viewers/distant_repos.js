import {get_mime_icon_path} from "../../utilities/mime_utils";
import {APP_CONFIG} from "../../types/app_config";

function get(item) {
    const url = `${APP_CONFIG.origin()}/api/item/preview/${item.id}/`;
    const thumbnail_url = `/api/item/thumbnail/${item.id}/`;
    const mimetype = item.mimetype.split('/');
    switch (mimetype[0]) {
        case 'image':
            return `<lazy-img class="item-large" src="${url}" alternate-src="${thumbnail_url}""/>`
        case 'video':
            return `<video class="item-large video-js" preload="auto" data-setup="{}" autoplay="true" preload="auto" controls="true" height="100%" width="100%">
                        <source src="${url}" type="${item.mimetype}">
                    </video>`
        case 'audio':
            return `<audio controls="true" src="${APP_CONFIG.origin()}/file/preview/${item.id}/"></audio>`
        case 'application':
            switch (mimetype[1]) {
                case 'x-pdf':
                case 'pdf':
                    return `<object data="${url}" type="application/pdf" width="100%" height="100%">
                                <pdf-embed src="${url}"></pdf-embed>
                            </object>`
                case 'json':
                case 'x-json':
                    return `<document-code src="${url}" class="language-json"></document-code>`
            }
            break;
        case 'text':
            switch (mimetype[1]) {
                case 'plain':
                    if (item.name.includes("log"))
                        return `<document-code src="${url}" class="language-log"></document-code>`
                    else
                        return `<document-code src="${url}" class="language-plain"></document-code>`
                case 'markdown':
                case 'x-markdown':
                    return `<document-markdown src="${url}"></document-markdown>`;
                case 'scss':
                case 'x-scss':
                    return `<document-code src="${url}" class="language-scss"></document-code>`
                case 'sass':
                case 'x-sass':
                    return `<document-code src="${url}" class="language-scss"></document-code>`
                case 'css':
                case 'x-css':
                    return `<document-code src="${url}" class="language-css"></document-code>`
                case 'rust':
                case 'x-rust':
                    return `<document-code src="${url}" class="language-rust"></document-code>`
                case 'javascript':
                case 'x-javascript':
                    return `<document-code src="${url}" class="language-js"></document-code>`
            }
            return `<document-code src="${url}" class="language-plain"></document-code>`
    }

    return `<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`;
}

export {get}