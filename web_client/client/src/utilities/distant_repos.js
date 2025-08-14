import {get_mime_icon_path} from "./mime_utils";

import '../../widgets/preview/object3d/object3d'

function get(app, item) {
    const url = `${app.origin()}/api/item/preview/${item.id}`;
    const thumbnail_url = `/api/item/thumbnail/${item.id}`;
    const mimetype = item.mimetype.split('/');

    const extension = item.name.split('.').pop();
    const extensions_3d = ["obj", "fbx", "stl", "dae", "ply", "glb", "gltf", "x3d", "x3db", "3ds", "blend"]
    if (extensions_3d.includes(extension)) {
        return `<object-3d src="${url}"></object-3d>`
    }

    switch (mimetype[0]) {
        case 'image':
            return `<lazy-img class="item-large" src="${url}" alternate-src="${thumbnail_url}""/>`
        case 'video':
            return `<dash-player item="${item.id}"></dash-player>`;
        case 'audio':
            return `<dash-player item="${item.id}" class="audio-only"></dash-player>`;
        case 'application':
            switch (mimetype[1]) {
                case 'x-pdf':
                case 'pdf':
                    return `<object data="${url}" type="application/pdf" width="100%" height="100%"><pdf-embed src="${url}"></pdf-embed></object>`
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

    return `<lazy-img class="item-large" src="${thumbnail_url}" alternate-src="${get_mime_icon_path(item.mimetype)}""/>`
}

export {get}