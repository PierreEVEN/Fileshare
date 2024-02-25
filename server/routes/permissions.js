const permissions = require('../permissions')
const {Directories} = require("../database/directories");
const {File} = require("../database/file_data");
const {Repos} = require("../database/repos");
const router = require('express').Router();

router.get('/upload-to-repos', async (req, res) => {
    if (req.user && req.query.repos) {
        if (await permissions.can_user_upload_to_repos(await Repos.from_id(req.query.repos), req.user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

router.get('/edit-repos', async (req, res) => {
    if (req.user && req.query.repos) {
        if (await permissions.can_user_edit_repos(await Repos.from_id(req.query.repos), req.user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

router.get('/edit-directory', async (req, res) => {
    if (req.user && req.query.directory) {
        if (await permissions.can_user_edit_directory(await Directories.from_id(req.query.directory), req.user.id))
            return res.sendStatus(200);
    }
    res.sendStatus(204);
})

router.get('/upload-to-directory', async (req, res) => {
    if (req.user && req.query.directory) {
        if (await permissions.can_user_upload_to_directory(await Directories.from_id(req.query.directory), req.user.id))
            return res.sendStatus(200);
    }
    res.sendStatus(204);
})

router.get('/edit-file', async (req, res) => {
    if (req.user && req.query.file) {
        const file = await File.from_id(req.query.file)
        if (!file)
            return res.sendStatus(204);

        if (file.owner === req.user.id)
            return res.sendStatus(200);

        if (file['directory']) {
            if (await permissions.can_user_edit_directory(await Directories.from_id(file.directory), req.user.id))
                return res.sendStatus(200);
        }
        if (await permissions.can_user_edit_repos(await Repos.from_id(file.repos), req.user.id))
            return res.sendStatus(200);
    }
    res.sendStatus(204);
})

module.exports = router;