const archiver = require('archiver');
const {logger} = require("../src/logger");
const {request_username, error_403, error_404, require_connection} = require("../src/session_utils");
const {Directories} = require("../src/database/directories");
const {Repos} = require("../src/database/repos");
const router = require('express').Router();
const {File} = require('../src/database/files')
const perms = require("../src/permissions");

router.get('/', async (req, res) => {

    if (!req.query.repos)
        return error_404(req, res);

    const repos = await Repos.from_access_key(req.query.repos);
    if (!repos)
        return error_404(req, res);

    if (!await perms.can_user_view_repos(repos, req.user ? req.user.id : null)) {
        if (require_connection(req, res))
            return;

        return error_403(req, res);
    }

    let files = []
    let path = '/';
    if (req.query.directory) {
        const dir = await Directories.from_path(Number(repos.id), req.query.directory)
        if (!dir) {
            files = await File.from_repos(repos.id)
        } else {
            files = await dir.get_files(true);
            path = await dir.get_absolute_path();
        }
    } else
        files = await File.from_repos(repos.id)

    const archive = archiver('zip', {});

    for (const file of files) {
        archive.file(file.storage_path(), {name: (file.parent_directory ? await (await Directories.from_id(file.parent_directory)).get_absolute_path() : '/') + decodeURIComponent(file.name)})
    }

    logger.info(`Archiving '${repos.access_key}${req.directory}' for ${request_username(req)} ...`)

    res.attachment(`${repos.name}.${path.replaceAll('/', '.')}.zip`.replace(/([^:]\.)\.+/g, "$1"));
    archive.on('error', err => {
        logger.error('Archive failed :', err.toString())
        res.status(500).send({message: err})
    });
    archive.pipe(res);
    await archive.finalize();
});

module.exports = router;