const hbs = require("handlebars");
const fs = require("fs");
const {parse} = require("path");

function get_available_mime_icons() {
    const icons = {};
    const mime_icons_path = `${__dirname}/../public/images/icons/mime-icons/`;
    const mime_icons_public_path = `/images/icons/mime-icons`;
    for (const file of fs.readdirSync(mime_icons_path)) {
        const stats = fs.statSync(`${mime_icons_path}/${file}`);
        if (stats.isFile()) {
            const filename = parse(file).name;
            if (!icons[filename])
                icons[filename] = {}
            icons[filename].base = `${mime_icons_public_path}/${file}`;
        } else if (stats.isDirectory()) {
            if (!icons[file])
                icons[file] = {}
            if (!icons[file].content)
                icons[file].content = {}
            for (const sub_file of fs.readdirSync(`${mime_icons_path}/${file}`)) {
                icons[file].content[parse(sub_file).name] = `${mime_icons_public_path}/${file}/${sub_file}`
            }
        }
    }
    return icons;
}

function loader_function(source) {
    const opts = {}

    const ast = hbs.parse(source, opts);
    const template = hbs.precompile(ast);
    const slug = template ? `
        const Handlebars = require('handlebars');
        const parser = new DOMParser();

        // Used to register contexts
        window.__handlebar_custom_loader = {
            __next_obj_id: 0,
            __registered_ctx: {}
        }
        
        Handlebars.get_mime_icons = () => JSON.parse('${JSON.stringify(get_available_mime_icons())}');
        
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
        ` : `module.exports = function() { return null; };`;

    this.async()(null, slug);
}

module.exports = loader_function;