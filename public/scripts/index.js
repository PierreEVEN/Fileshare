

import '../stylesheets/layout.scss'

const handlebars = require('handlebars')

module.mustache = {
    templates: {},
    render: async (path, data) => {

        if (!module.mustache.templates[path]) {
            module.mustache.templates[path] = await (await fetch(`/templates/${path}.hbs`)).text();
        }

        const div = document.createElement('div')
        div.innerHTML = handlebars.render(module.mustache.templates[path], data)
        return div.children[0];
    },
    render_raw: (raw, data) => {
        const div = document.createElement('div')
        div.innerHTML = handlebars.render(raw, data)
        return div.children[0];
    },
    internal: handlebars
}

require('./utils.js');
require('./views/auth.js');
require('./views/create-repos-form.js');
require('./views/upload_form.js');
require('./views/repos_builder/repos_builder.js');
require('./views/delete_repos_form.js');

module.mime = require('mime');
