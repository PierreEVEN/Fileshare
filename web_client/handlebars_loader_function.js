const Handlebars = require('handlebars');
const parser = new DOMParser();

// Used to register contexts
if (!document.__handlebar_custom_loader)
    document.__handlebar_custom_loader = {
        __next_obj_id: 0,
        __next_container_id: 0,
        __registered_ctx: {},
        __registered_objects_container: {}
    }

Handlebars.get_mime_icons = () => JSON.parse('{{mime_icons}}');

module.exports = (data, ctx) => {
    if (ctx) {
        if (!ctx['__handlebar_ctx_id']) {
            ctx.__handlebar_ctx_id = ++document.__handlebar_custom_loader.__next_obj_id;
            document.__handlebar_custom_loader.__registered_ctx[ctx.__handlebar_ctx_id] = ctx;
        }
        data.__handlebar_ctx_id = ctx.__handlebar_ctx_id;
    }

    const container_id = String(++document.__handlebar_custom_loader.__next_container_id);

    document.__handlebar_custom_loader.__registered_objects_container[container_id] = new Map();

    if (!data)
        data = {};

    data['__registered_objects_container_id'] = container_id;
    const generated_html = Handlebars.template('{{template}}')(data);
    const body = parser.parseFromString(generated_html, 'text/html').body;


    const elements = {};
    let container = document.__handlebar_custom_loader.__registered_objects_container[container_id];
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

        for (const [key, value] of document.__handlebar_custom_loader.__registered_objects_container[container_id]) {
            const found_element = attribute_map.get(value);
            if (!found_element) {
                console.error(`Failed to register element with id ${key}`);
                continue;
            }
            elements[key] = found_element;
        }
    }
    if (body.children.length === 1) {
        body.children[0].elements = elements;
        return body.children[0];
    }
    delete document.__handlebar_custom_loader.__registered_objects_container[container_id];
    // Force children generation
    const children = [];
    for (let i = 0; i < body.children.length; ++i) {
        body.children[i].elements = elements;
        children.push(body.children[i]);
    }
    children.elements = elements;
    return children;
}