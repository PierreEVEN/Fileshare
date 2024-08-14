require('../stylesheets/layout.scss');

import './handlebars_helpers';

//@TODO : don't importing this cause a weird issue when rendering pdf...
require('../embed_viewers/custom_elements/pdf_viewer/pdf-viewer.hbs')
require('../embed_viewers/custom_elements/document/code')
require('../embed_viewers/custom_elements/document/markdown')
require('../embed_viewers/custom_elements/pdf_viewer/pdf-viewer')

/* WIDGETS */
import './widgets/auth/auth.js';
import './widgets/create_repos/create-repos-form.js';
import './widgets/viewport/repos_builder.js';
import './widgets/delete_repos/delete_repos_form.js';
import './widgets/edit_repos/edit_repos_form.js';
import './drop_box.js';
import './widgets/user_settings/user_settings.js';
import './widgets/viewport/file_list_customization.js'

/* VIEWPORT */
import './widgets/viewport/path_builder';
import './widgets/upload/upload_form.js';

import './administration/administration_panel';