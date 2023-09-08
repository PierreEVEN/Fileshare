import '../stylesheets/layout.scss'
const Handlebars = require('handlebars');
require('./mime_image_generator')
Handlebars.registerHelper("ctx", function(options) {
    if (!this.__handlebar_ctx_id)
        return console.error('This template was not instanced with a context');
    return new Handlebars.SafeString("window.__handlebar_custom_loader.__registered_ctx[" + this.__handlebar_ctx_id + "]." + options);
});

require('./utils.js');
require('./views/auth/auth.js');
require('./views/create-repos-form.js');
require('./views/upload/upload_form.js');
require('./views/repos_builder/repos_builder.js');
require('./views/delete_repos_form.js');
require('./views/repos_builder/path')