import {humanFileSize} from "../../../common/tools/utils.js";
import * as handlebars from "handlebars";
import {get_mime_icon_path} from "../../../common/tools/mime_utils";

let opened_item_div = null;

function open_this_item(div, file) {
    import('../../../embed_viewers').then(_ => {
        const ctx = {
            'close_item_plain': close_item_plain,
        };
        if (!opened_item_div) {
            opened_item_div = require('./item.hbs')({
                    item: file,
                    file_size: humanFileSize(file.size)
                },
                ctx);
            document.body.append(opened_item_div);
        } else {
            import('../../../embed_viewers/custom_elements/document/showdown_loader.js').then(showdown => {
                document.getElementById('item-title').innerText = file.name;
                document.getElementById('item-size').innerText = humanFileSize(file.size);
                document.getElementById('item-mime-type').innerText = file.mimetype;
                document.getElementById('item-description').innerHTML = file.description && file.description !== '' ? showdown.convert_text(file.description) : '';
                document.getElementById('item-content').innerHTML = handlebars.compile('{{item_image item}}')({item: file});
                document.getElementsByClassName('typeicon')[0].src = get_mime_icon_path(file.mimetype);
            })
        }
    });
}

window.addEventListener('resize', _ => {
    if (opened_item_div) {
        opened_item_div.style.width = window.innerWidth + 'px';
        opened_item_div.style.height = window.innerHeight + 'px';
    }
})

function close_item_plain() {
    if (opened_item_div)
        opened_item_div.remove();
    opened_item_div = null;
}

function is_opened() {
    return !!opened_item_div;
}

export {open_this_item, is_opened, close_item_plain}