import {get_mime_icon_path} from "../common/tools/mime_utils";
import {PAGE_CONTEXT} from "../common/tools/utils";

function get(item) {
    const url = `${PAGE_CONTEXT.repos_path()}/file/${item.id}`;
    const thumbnail_url = `${PAGE_CONTEXT.repos_path()}/thumbnail/${item.id}`;
    const mimetype = item.mimetype.plain().split('/');
    switch (mimetype[0]) {
        case 'image':
            return `<lazy-img class="item-large" src="${url}" alternate-src="${thumbnail_url}""/>`
        case 'video':
            return `<video class="item-large video-js" preload="auto" data-setup="{}" autoplay="true" preload="auto" controls="true" height="100%" width="100%">
                        <source src="${url}" type="${item.mimetype}">
                    </video>`
        case 'audio':
            return `<audio controls="true" src="${PAGE_CONTEXT.repos_path()}/file/${item.id}"></audio>`
        case 'application':
            switch (mimetype[1]) {
                case 'x-pdf':
                case 'pdf':
                    return `<object data="${url}" type="application/pdf" width="100%" height="100%">
                                <pdf-embed src="${url}"></pdf-embed>
                            </object>`
                case 'json':
                case 'x-json':
                    return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-json"></document-code>`
                case 'javascript':
                case 'x-javascript':
                    return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-js"></document-code>`
            }
            break;
        case 'text':
            switch (mimetype[1]) {
                case 'plain':
                    if (item.name.plain().includes("log"))
                        return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-log"></document-code>`
                    else
                        return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-plain"></document-code>`
                case 'markdown':
                case 'x-markdown':
                    return `<document-markdown src="${PAGE_CONTEXT.repos_path()}/file/${item.id}"></document-markdown>`;
                case 'scss':
                case 'x-scss':
                    return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-scss"></document-code>`
                case 'sass':
                case 'x-sass':
                    return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-scss"></document-code>`
                case 'css':
                case 'x-css':
                    return `<document-code src="${PAGE_CONTEXT.repos_path()}/file/${item.id}" class="language-css"></document-code>`
            }
            return `<document-embed src="${PAGE_CONTEXT.repos_path()}/file/${item.id}"></document-embed>`
    }

    return `<img class="item-small" src="${get_mime_icon_path(item.mimetype)}" alt="document: ${item.name}"/>`;
}

export {get}