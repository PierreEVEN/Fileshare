const express = require('express');
const router = express.Router();
const Repos = require('../../src/database/tables/repos')
const Files = require('../../src/database/tables/files')
const session_utils = require("../../src/session_utils");
const path = require('path');

// Upload
const upload = require("./upload");
const {error_404, error_403, session_data, public_data} = require("../../src/session_utils");
const fs = require("fs");
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
        public_data: await public_data().get(),
    });
});

router.get('/:repos/file/:file/', async function (req, res) {

    if (!req.params.repos || !req.params.file) {
        return error_404(req, res);
    }

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


    const file = await Files.find(req.params.file)

    if (!file)
        return error_404(req, res);

    const file_path = `./${await file.get_storage_path()}`

    if (fs.existsSync(file_path)) {
        res.sendFile(path.resolve(file_path))
        //res.download(file_path, file.name);
    }
})

module.exports = router;