const express = require('express');
const router = express.Router();
const db = require("../../database");
const fs = require("fs");
const Repos = require('../../src/database/tables/repos')
const session_utils = require("../../src/session_utils");

// Upload
const upload = require("./upload");
const {error_404, error_403, session_data, public_data} = require("../../src/session_utils");
router.get('/:repos/upload', upload.view)
router.post('/:repos/upload', upload.post_upload);

router.get('/:repos', async function (req, res, next) {

    const found_repos = await Repos.find_access_key(req.params.repos);
    if (!found_repos)
        return error_404(req, res);

    // If repos is private, request connexion and ensure the user is the owner
    if (await found_repos.get_status() === 'private') {
        if (session_utils.require_connection(req, res))
            return;

        if ((await found_repos.get_owner()).get_id() !== session_data(req).connected_user.get_id()) {
            return error_403(req, res)
        }
    }

    session_data(req).select_repos(found_repos);

    res.render('fileshare/repos', {
        title: `FileShare - ${await found_repos.get_name()}`,
        session_data: await session_data(req).client_data(),
        public_data: await public_data(),
    });
});


/*
router.get('/download', async function (request, response) {

    if (!request.query.file) {
        return;
    }

    const connection = await db();
    let file = Object.values(await connection.query('SELECT * FROM Personal.Files.js WHERE id = ?', [request.query.file]));
    await connection.end()

    if (file.length > 0) {
        file = file[0]
        const file_path = `./${file.storage_path}`
        if (fs.existsSync(file_path)) {
            response.download(file_path, file.name); // Set disposition and send it.
        }
    }
})
 */

module.exports = router;