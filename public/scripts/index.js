import '../stylesheets/layout.scss'

const hbs = require('handlebars')

window.handlebars = {
    render: (raw, data) => {
        const div = document.createElement('div')
        const template = hbs.compile(raw)
        div.innerHTML = template(data)
        return div.children[0];
    }
}

require('./utils.js');
require('./views/auth/auth.js');
require('./views/create-repos-form.js');
require('./views/upload_form.js');
require('./views/repos_builder/repos_builder.js');
require('./views/delete_repos_form.js');
require('./views/repos_builder/path')