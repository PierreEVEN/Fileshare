function picture_from_mime_type(url, mimetype, thumbnail = false) {
    if (mimetype.startsWith('video/')) {
        if (url.endsWith('/thumbnail')) {
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
    image.onError = () => {
        image.onError = null;
        image.src = 'https://img.icons8.com/fluency/96/no-image.png'
    }
    image.classList.add('item-thumbnail');
    image.alt = 'No preview';
    if (mimetype.startsWith('image/'))
        image.src = url;
    else if (mimetype === 'text/plain')
        image.src = 'https://img.icons8.com/?size=512&id=12053';
    else if (mimetype === 'application/pdf')
        image.src = 'https://img.icons8.com/?size=512&id=13417';
    else if (mimetype === 'application/octet-stream')
        image.src = 'https://img.icons8.com/?size=512&id=38992';
    else
        image.src = 'https://img.icons8.com/external-vectorslab-outline-color-vectorslab/53/external-404-File-files-and-folders-vectorslab-outline-color-vectorslab.png'
    return image;
}

function gen_item(name, url, size, mimetype, thumbnail) {
    if (mimetype.startsWith('video/') && !thumbnail) {
        const video = document.createElement('video')
        video.classList.add('video-js');
        video.height = '100%';
        video.width = '90%';
        video.preload = 'auto';
        video.autoplay = true;
        video['data-setup'] = {};

        const source = document.createElement('source')
        source.src = url;
        source.type = mimetype;
        video.append(source);
        return video;
    }
    return picture_from_mime_type(url + (thumbnail ? '/thumbnail' : ''), mimetype, true);
}


let opened_item_div = null;

function open_this_item(div, file) {

    const url = '/fileshare/repos/' + current_repos.access_key + '/file/' + file.id;
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

        if (document.last_selected_item)
            document.last_selected_item.remove();

        document.last_selected_item = opened_item_div;
        document.body.append(opened_item_div)
    }

    opened_item_div.innerHTML = '';
    opened_item_div.append(gen_item(file.name, url, file.size, file.mimetype, false));
    opened_item_div.onclick = (e) => {
        if (e.target === document.last_selected_item)
            close_item_plain();
    }
}

document.onkeydown = (e) => {
    if (e.key === "Escape") { // escape key maps to keycode `27`
        close_item_plain();
    }
}

function close_item_plain() {
    if (document.last_selected_item)
        document.last_selected_item.remove()
    document.last_selected_item = null;
    opened_item_div = null;
}


function is_opened() {
    return !!opened_item_div;
}

export {gen_item, open_this_item, picture_from_mime_type, is_opened, close_item_plain}