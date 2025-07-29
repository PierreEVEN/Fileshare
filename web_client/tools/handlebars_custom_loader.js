const hbs = require("handlebars");
const fs = require("fs");

function loader_function(source) {
    const opts = {}

    const ast = hbs.parse(source, opts);
    const template = hbs.precompile(ast);
    let data_text = fs.readFileSync("./tools/handlebars_loader_function.js").toString()
        .replaceAll("'{{template}}'", template.toString());

    const slug = template ? data_text : `module.exports=function(){}`;

    this.async()(null, slug);
}

module.exports = loader_function;