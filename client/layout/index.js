require('./stylesheets/layout.scss');

import './handlebars_helpers';

//@TODO : don't importing this cause a weird issue when rendering pdf...
require('../embed_viewers/custom_elements/pdf_viewer/pdf-viewer.hbs')

/* WIDGETS */
import './widgets/auth/auth.js';
import './widgets/create_repos/create-repos-form.js';
import './widgets/viewport/repos_builder.js';
import './widgets/delete_repos/delete_repos_form.js';

/* VIEWPORT */
import './widgets/viewport/path';
import './widgets/upload/upload_form.js';
