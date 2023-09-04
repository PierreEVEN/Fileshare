import mustache from "https://cdnjs.cloudflare.com/ajax/libs/mustache.js/4.2.0/mustache.min.js"

module.mustache = {
    templates: {},
    render: async (path, data) => {

        if (!module.mustache.templates[path]) {
            module.mustache.templates[path] = await (await fetch(`/templates/${path}.mustache`)).text();
        }

        const div = document.createElement('div')
        div.innerHTML = mustache.render(module.mustache.templates[path], data)
        return div.children[0];
    },
    render_raw: (raw, data) => {
        const div = document.createElement('div')
        div.innerHTML = mustache.render(raw, data)
        return div.children[0];
    },
    internal: mustache
}


import mime from 'https://cdn.skypack.dev/mime'

module.mime = mime;

import './views/auth.js'
import './views/create-repos-form.js'
import './utils.js'
import './views/upload_form.js'
import './views/repos_builder/repos_builder.js'
import './views/delete_repos_form.js'