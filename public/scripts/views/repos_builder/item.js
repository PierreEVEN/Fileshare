import {humanFileSize, mime_icon} from "../../utils.js";
import * as handlebars from "handlebars";

const item_hbs = require('./item.hbs')


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
    if (mimetype && !mimetype.startsWith('video/') && !mimetype.startsWith('image/')) {

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
    const ctx = {
        close_item_plain: close_item_plain,
    };
    if (!opened_item_div) {
        opened_item_div = item_hbs({item: file, file_size: humanFileSize(file.size)}, ctx);
        document.body.append(opened_item_div);
    }
    else {
        document.getElementById('item-title').innerText = file.name;
        document.getElementById('item-size').innerText = file.size;
        document.getElementById('item-mime-type').innerText = file.mimetype;
        document.getElementById('item-content').innerHTML = handlebars.compile('{{item_image item}}')({item: file});
    }
}

window.addEventListener('resize', _ => {
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