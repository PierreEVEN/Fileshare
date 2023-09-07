const hbs = require("handlebars");

function loader_function(source) {
    const opts = {}

    const ast = hbs.parse(source, opts);
    const template = hbs.precompile(ast);

    const slug = template
        ? `var Handlebars = require('handlebars');
            function __default(obj) { 
                return obj && (obj.__esModule ? obj["default"] : obj); 
            }
            
            const func = (Handlebars["default"] || Handlebars).template(${template});
            
            module.exports = (data) => {
                const compiled = new DOMParser().parseFromString(func(data), 'text/html')
                console.log(compiled);
                return compiled;
            }` :
        `module.exports = function() { return ""; };`;

    this.async()(null, slug);
}

module.exports = loader_function;