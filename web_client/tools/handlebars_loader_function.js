const Handlebars = require('handlebars');
const parser = new DOMParser();

// Used to register contexts
if (!document.__hbs_cl)
    document.__hbs_cl = {
        // Next object id
        noid: 0,
        // Next container id
        ncid: 0,
        // registered_ctx
        ctx: {},
        // registered object container
        c: {}
    }

module.exports = (data, ctx) => {
    if (ctx) {
        if (!ctx.__hbs_cid) {
            ctx.__hbs_cid = ++document.__hbs_cl.noid;
            document.__hbs_cl.ctx[ctx.__hbs_cid] = ctx;
        }
        data.__hbs_cid = ctx.__hbs_cid;
    }

    const container_id = String(++document.__hbs_cl.ncid);

    document.__hbs_cl.c[container_id] = new Map();

    if (!data)
        data = {};

    data.c_id = container_id;
    const generated_html = Handlebars.template('{{template}}')(data);
    const body = parser.parseFromString(generated_html, 'text/html').body;


    const elements = {};
    let container = document.__hbs_cl.c[container_id];
    if (container.size > 0) {
        const attribute_map = new Map();

        function recursive_fetch_items_ids(item) {
            let attribute = item.getAttribute('__custom-id');
            if (attribute)
                attribute_map.set(attribute, item);
            for (const child of item.children) {
                recursive_fetch_items_ids(child);
            }
        }
        recursive_fetch_items_ids(body);

        for (const [key, value] of document.__hbs_cl.c[container_id]) {
            const found_element = attribute_map.get(value);
            if (!found_element) {
                console.error(`Failed to register element with id ${key}`);
                continue;
            }
            elements[key] = found_element;
        }
    }
    if (body.children.length === 1) {
        body.children[0].hb_elements = elements;
        return body.children[0];
    }
    delete document.__hbs_cl.c[container_id];
    // Force children generation
    const children = [];
    for (let i = 0; i < body.children.length; ++i) {
        body.children[i].hb_elements = elements;
        children.push(body.children[i]);
    }
    children.hb_elements = elements;
    return children;
}