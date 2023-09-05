import '../stylesheets/layout.scss'

const handlebars = require('handlebars')

window.mustache = {
    templates: {},
    render: async (path, data) => {

        if (!window.mustache.templates[path]) {
            const data = await (await fetch(`/templates/${path}.hbs`)).text();
            window.mustache.templates[path] = handlebars.compile(data)
        }

        const div = document.createElement('div')
        div.innerHTML = window.mustache.templates[path](data)
        return div.children[0];
    },
    render_raw: (raw, data) => {
        const div = document.createElement('div')
        const template = handlebars.compile(raw)
        div.innerHTML = template(data)
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
