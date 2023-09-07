const hbs = require("handlebars");

function loader_function(source) {
    const opts = {}

    const ast = hbs.parse(source, opts);
    const template = hbs.precompile(ast);
    const slug = template
        ? `
        const Handlebars = require('handlebars');
        const parser = new DOMParser();
        window.__handlebar_custom_loader = {
            __next_obj_id: 0,
            __registered_ctx: {},
        }
        Handlebars.registerHelper("ctx", function(options) {
            if (!this.__handlebar_ctx_id)
                return console.error('This template was not instanced with a context');
            return "window.__handlebar_custom_loader.__registered_ctx[" + this.__handlebar_ctx_id + "]." + options;
        });
        module.exports = (data, ctx) => {
            if (ctx) {
                    if (!ctx['__handlebar_ctx_id']) {
                    ctx.__handlebar_ctx_id = ++window.__handlebar_custom_loader.__next_obj_id;
                    window.__handlebar_custom_loader.__registered_ctx[ctx.__handlebar_ctx_id] = ctx;
                }
                data.__handlebar_ctx_id = ctx.__handlebar_ctx_id;
            }
            
            const body = parser.parseFromString(Handlebars.template(${template})(data), 'text/html').body;
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