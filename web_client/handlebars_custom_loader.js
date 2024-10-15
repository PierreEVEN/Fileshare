const hbs = require("handlebars");
const fs = require("fs");
const {parse} = require("path");

function get_available_mime_icons() {
    const icons = {};
    const mime_icons_path = `${__dirname}/public/images/icons/mime-icons/`;
    const mime_icons_public_path = `/public/images/icons/mime-icons`;
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
    let data_text = fs.readFileSync("./handlebars_loader_function.js").toString()
        .replaceAll("'{{template}}'", template.toString())
        .replaceAll("'{{mime_icons}}'", "'" + JSON.stringify(get_available_mime_icons()) + "'");
    const slug = template ? data_text : `module.exports = function() { return null; };`;

    this.async()(null, slug);
}

module.exports = loader_function;