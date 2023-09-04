import {humanFileSize, mime_icon} from "../../utils.js";

function make_standard_icon(mime_type) {
    const image = document.createElement('img');
    image.classList.add('item-thumbnail');
    image.src = mime_icon(mime_type)
    image.onError = () => {
        image.onError = null;
        image.src = '/images/icons/no-mime-icon.png'
    }
    return image;
}

function picture_from_mime_type(url, mimetype, thumbnail = false) {
    if (!mimetype)
        return make_standard_icon(null);

    if (mimetype.startsWith('video/')) {
        if (url.includes('/thumbnail')) {
            const div = document.createElement('div');
            div.classList.add('item-preview');

            const image = document.createElement('img');
            image.onError = () => {
                image.onError = null;
                image.src = 'https://img.icons8.com/fluency/96/no-image.png'
            }
            image.alt = 'No preview';
            image.src = url;
            image.classList.add('item-thumbnail')
            div.append(image);

            const play_button = document.createElement('img');
            play_button.src = '/images/icons/icons8-play-64.png'
            div.append(play_button)

            return div;
        }

        const video = document.createElement('video');
        video.classList.add('item-thumbnail');
        video.classList.add('video-js');
        video.preload = 'auto'
        video['data-setup'] = '{}';
        const source = document.createElement('source');
        source.src = url;
        source.type = mimetype;
        video.append(source);
        return video;
    }

    const image = document.createElement('img');
    image.classList.add('item-thumbnail');
    image.alt = url;
    image.src = mimetype.startsWith('image/') ? url : mime_icon(mimetype);
    image.onError = () => {
        image.onError = null;
        image.src = mime_icon(null)
    }
    return image;
}

function gen_item(name, url, size, mimetype, thumbnail) {
    if (!thumbnail) {
        if (mimetype.startsWith('video/')) {
            const video = document.createElement('video')
            video.classList.add('video-js');
            video.height = '100%';
            video.width = '90%';
            video.preload = 'auto';
            video.autoplay = true;
            video.controls = true;
            video['data-setup'] = {};

            const source = document.createElement('source')
            source.src = url;
            source.type = mimetype;
            video.append(source);
            return video;
        } else if (mimetype.startsWith('audio/')) {
            const audio = document.createElement('audio')
            audio.controls = true;
            audio.src = url;
            return audio;
        }
    }
    if (!mimetype.startsWith('video/') && !mimetype.startsWith('image/')) {

        const div = document.createElement('div');
        div.classList.add('item-preview');
        div.append(picture_from_mime_type(url + (thumbnail ? '/thumbnail' : ''), mimetype, true));

        const text_name = document.createElement('p');
        text_name.innerText = name
        div.append(text_name)

        return div;
    }

    const params = new URLSearchParams(url.split('?')[1]);
    return picture_from_mime_type(`/file${(thumbnail ? '/thumbnail' : '')}/?file=${params.get('file')}`, mimetype, true);
}


let opened_item_div = null;

function open_this_item(div, file) {

    const url = `/file/?file=${file.id}`;
    if (!opened_item_div) {
        opened_item_div = document.createElement('div');
        opened_item_div.classList.add('item-plain')
        if (div) {
            opened_item_div.style.width = div.getBoundingClientRect().width + 'px';
            opened_item_div.style.height = div.getBoundingClientRect().height + 'px';
            opened_item_div.style.left = div.getBoundingClientRect().x + 'px';
            opened_item_div.style.top = div.getBoundingClientRect().y + 'px';
        } else {
            opened_item_div.style.width = '100%';
            opened_item_div.style.height = '100%';
            opened_item_div.style.left = '0';
            opened_item_div.style.top = '0';
        }

        if (document.item_container)
            document.item_container.remove();


        const close_button = document.createElement('button');
        close_button.style.position = 'absolute';
        close_button.innerText = 'Fermer';
        close_button.style.zIndex = '1';
        close_button.onclick = () => close_item_plain()
        opened_item_div.append(close_button);

        const details_panel = document.createElement('div');
        details_panel.classList.add('details-panel');
        {
            const filename = document.createElement('h1');
            opened_item_div.file_name = filename;
            details_panel.append(filename);

            const filesize = document.createElement('p');
            opened_item_div.file_size = filesize;
            details_panel.append(filesize);

            const mime_type = document.createElement('p');
            opened_item_div.mime_type = mime_type;
            details_panel.append(mime_type);
        }
        opened_item_div.append(details_panel);

        const item_container = document.createElement('div');
        item_container.style.flexGrow = '1';
        item_container.style.display = 'flex';
        item_container.style.justifyContent = 'center';
        item_container.style.alignItems = 'center';
        opened_item_div.append(item_container);
        document.body.append(opened_item_div)

        document.item_container = item_container;
    }

    opened_item_div.file_name.innerText = file.name;
    opened_item_div.file_size.innerText = humanFileSize(file.size);
    opened_item_div.mime_type.innerText = file.mimetype;

    document.item_container.innerHTML = '';
    document.item_container.append(gen_item(file.name, url, file.size, file.mimetype, false));
}

window.addEventListener('resize', (result) => {
    if (opened_item_div) {
        opened_item_div.style.width = window.innerWidth + 'px';
        opened_item_div.style.height = window.innerHeight + 'px';
    }
})


function close_item_plain() {
    if (opened_item_div)
        opened_item_div.remove()
    document.last_selected_item = null;
    opened_item_div = null;
}


function is_opened() {
    return !!opened_item_div;
}

export {gen_item, open_this_item, picture_from_mime_type, is_opened, close_item_plain}