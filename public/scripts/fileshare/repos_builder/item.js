function picture_from_mime_type(url, mimetype) {
    if (mimetype.startsWith('video/')) {
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
        console.log("no preview")
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
    if (mimetype.startsWith('image/'))
        if (thumbnail)
            return `<img src="${url}/thumbnail" alt = "${name}">`
        else
            return `<img src="${url}" alt="${name}">`
    else if (mimetype === 'text/plain')
        return `<img src="https://img.icons8.com/?size=512&id=12053" alt="document">`
    else if (mimetype === 'application/pdf')
        return `<img src="https://img.icons8.com/?size=512&id=13417" alt="document">`
    else if (mimetype === 'application/octet-stream')
        return `<img src="https://img.icons8.com/?size=512&id=38992" alt="document">`
    else if (mimetype.startsWith('video/')) {
        if (thumbnail)
            return `<img src="${url}/thumbnail" alt = "${name}">
                            <img src="/images/icons/icons8-play-64.png" alt="play icon">`
        else
            return `<video id="my-video" class="video-js" controls width="100%" height="90%" preload="auto" autoplay="true" data-setup="{}">
                    <source src="${url}" type="${mimetype}">
                    <p class="vjs-no-js"> To view this video please enable JavaScript, and consider upgrading to a web browser that
                    </p>
                    <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>
                </video>`
    }

    return `<p>${name}</p>`
}


function open_this_item(div, file, url) {
    const new_div = document.createElement('div');
    new_div.classList.add('item-plain')
    if (div) {
        new_div.style.width = div.getBoundingClientRect().width + 'px';
        new_div.style.height = div.getBoundingClientRect().height + 'px';
        new_div.style.left = div.getBoundingClientRect().x + 'px';
        new_div.style.top = div.getBoundingClientRect().y + 'px';
    } else {
        new_div.style.width = '100%';
        new_div.style.height = '100%';
        new_div.style.left = '0';
        new_div.style.top = '0';
    }

    if (document.last_selected_item)
        document.last_selected_item.remove();

    document.last_selected_item = new_div;
    document.body.append(new_div)

    new_div.innerHTML = gen_item(file.name, url, file.size, file.mimetype, false);
    new_div.onclick = (e) => {
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
    document.last_selected_item = null
}


export {gen_item, open_this_item, picture_from_mime_type}