const hbs = require("handlebars");
const fs = require("fs");
const {parse} = require("path");
const Handlebars = require("handlebars");


let mime_switch_string = '';

(function gen_mime_file_type_switch() {
    mime_switch_string = '';
    const mime_icons_path = `${__dirname}/../public/images/icons/mime-icons/`;
    const mime_icons_public_path = `/images/icons/mime-icons`;
    const hierarchy = {};
    for (const file of fs.readdirSync(mime_icons_path)) {
        const stats = fs.statSync(`${mime_icons_path}/${file}`);
        if (stats.isFile()) {
            const filename = parse(file).name;
            if (!hierarchy[filename])
                hierarchy[filename] = {}
            hierarchy[filename].base = `${mime_icons_public_path}/${file}`;
        } else if (stats.isDirectory()) {
            if (!hierarchy[file])
                hierarchy[file] = {}
            if (!hierarchy[file].content)
                hierarchy[file].content = {}
            for (const sub_file of fs.readdirSync(`${mime_icons_path}/${file}`)) {
                hierarchy[file].content[parse(sub_file).name] = `${mime_icons_public_path}/${sub_file}`
            }
        }
    }

    for (const [name, data] of Object.entries(hierarchy)) {
        let special = '';
        if (data.content) {
            special = 'switch ("mime[1]") {\n'
            for (const [name, path] of Object.entries(data.content))
                special += `case '${name}':
                                return '${path}';\n`
            special += '}\n'
        }

        mime_switch_string += `
        case ('${name}'):
            ${special}
            return '${data.base}';\n`
    }
})()

function loader_function(source) {
    const opts = {}

    const ctx_getter_helper = `
    function(options) {
        if (!this.__handlebar_ctx_id)
            return console.error('This template was not instanced with a context');
        return "window.__handlebar_custom_loader.__registered_ctx[" + this.__handlebar_ctx_id + "]." + options;
    }`

    const mime_image_generator_helper = `
    function mime_image_generator_helper(item, is_small) {
        console.log(item)
        
        const get_mime_icon = mimetype => {
            const mime = mimetype.split('/');
            switch (mime[0]) {
                ${mime_switch_string}
            };
            return '/images/icons/no-mime-icon.png';
        }
        
        const does_mimetype_has_thumbnail = mimetype => {
            if (!mimetype)
                return false;
            const begin = mimetype.split('/')[0];
            switch (begin) {
                case 'video':
                case 'image':
                return true;
            }
            return false;            
        }
        
        // DEFAULT CASE
        let res = "<p>Undefined object</p>>";     
        
        // CASE : IS STANDARD DIRECTORY   
        if (item.is_directory) {
            res = '<img src="/images/icons/icons8-folder-96.png" alt="dossier: ' + item.name + '">'
        }
        
        // CASE : IS STANDARD FILE 
        else if (item.is_file) {
            const get_file_icon = (mimetype) => {
                if (mimetype && mimetype !== '') {                
                    const mime = mimetype.split('/');
                    switch (mime[0]) {
                        ${mime_switch_string}
                    };
                }
                return '/images/icons/no-mime-icon.png';
            }
            
            // Default mime icon
            res = '<img class="' + (is_small ? 'item-small' : 'item-large') + '" src="' + get_file_icon(item.mimetype) + '" alt="fichier: ' + item.name + '"/>';
            
            // Distant repos
            if (item.id) {
                // We want a thumbnail
                if (is_small && does_mimetype_has_thumbnail(item.mimetype)) {
                    // Add play button
                    if (item.mimetype && item.mimetype.startsWith('video'))
                        res = '<div class="item-small">\\n' +
                                    '<img class="item-background" src="/file/thumbnail/?file=' + item.id + '" alt="fichier: ' + item.name + '" onError="this.onError = null; this.src=' + '/images/icons/mime-icons/image.png' + '"/>\\n' +
                                    '<img class="item-overlay" src="/images/icons/icons8-play-64.png" alt="play button">\\n' +
                               '</div>'
                    else
                        res = '<img class="item-small" src="/file/thumbnail/?file=' + item.id + '" alt="fichier: ' + item.name + '" onError="this.onError = null; this.src=' + '/images/icons/mime-icons/image.png' + '"/>'
                }
                
                // Handle cases manually
                if (!is_small) {
                    switch (item.mimetype.split('/')[0]) {
                        case 'image':
                            res = '<img class="item-large" src="/file/?file=' + item.id + '" alt="image: ' + item.name + '" onError="this.onError = null; this.src=' + '/images/icons/mime-icons/image.png' + '"/>'
                            break;
                        case 'video':
                            res = '<video class="item-large video-js" preload="auto" data-setup="{}" autoplay="true" preload="auto" height="100%" width="100%"><source src="/file/?file=' + item.id + '" type="' + item.mimetype + '"></video>'
                            break;
                        case 'audio':
                            res = '<audio controls="true" src="/file/?file=' + item.id + '"></audio>'
                            break;
                    }
                }
            }
        }

        console.log('res :', res);
        return new Handlebars.SafeString(res);
    }`

    const ast = hbs.parse(source, opts);
    const template = hbs.precompile(ast);
    const slug = template
        ? `
        const Handlebars = require('handlebars');
        const parser = new DOMParser();
        window.__handlebar_custom_loader = {
            __next_obj_id: 0,
            __registered_ctx: {}
        }
        Handlebars.registerHelper("ctx", ${ctx_getter_helper});
        ${mime_image_generator_helper};
        Handlebars.registerHelper("item_image", (options) => mime_image_generator_helper(options, false));
        Handlebars.registerHelper("item_thumbnail", (options) => mime_image_generator_helper(options, true));
        module.exports = (data, ctx) => {
            if (ctx) {
                    if (!ctx['__handlebar_ctx_id']) {
                    ctx.__handlebar_ctx_id = ++window.__handlebar_custom_loader.__next_obj_id;
                    window.__handlebar_custom_loader.__registered_ctx[ctx.__handlebar_ctx_id] = ctx;
                }
                data.__handlebar_ctx_id = ctx.__handlebar_ctx_id;
            }
            
            const generated_html = Handlebars.template(${template})(data);
            const body = parser.parseFromString(generated_html, 'text/html').body;
            if (body.children.length === 1)
                return body.children[0];
            
            // Force children generation
            const children = [];
            for (let i = 0; i < body.children.length; ++i)
                children.push(body.children[i]);
            return children;
        }
        ` :
        `module.exports = function() { return null; };`;

    this.async()(null, slug);
}

module.exports = loader_function;