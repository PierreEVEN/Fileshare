const path = require("path");
const fs = require("fs");

function generate_available_mime_icons() {
    const icons = {};
    const __dirname = path.resolve('.');
    const mime_icons_path = `${__dirname}/public/images/icons/mime-icons/`;
    const mime_icons_public_path = `/public/images/icons/mime-icons`;
    for (const file of fs.readdirSync(mime_icons_path)) {
        const stats = fs.statSync(`${mime_icons_path}/${file}`);
        if (stats.isFile()) {
            const filename = path.parse(file).name;
            if (!icons[filename])
                icons[filename] = {}
            icons[filename].base = `${mime_icons_public_path}/${file}`;
        } else if (stats.isDirectory()) {
            if (!icons[file])
                icons[file] = {}
            if (!icons[file].content)
                icons[file].content = {}
            for (const sub_file of fs.readdirSync(`${mime_icons_path}/${file}`)) {
                icons[file].content[path.parse(sub_file).name] = `${mime_icons_public_path}/${file}/${sub_file}`
            }
        }
    }

    fs.writeFileSync(`${__dirname}/client/utilities/mime_icon_list.js`, `module.exports = ${JSON.stringify(icons)}`);
}

generate_available_mime_icons();