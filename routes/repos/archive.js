const archiver = require('archiver');
const db = require("../../src/database");
const path = require("path");
const {logger} = require("../../src/logger");
const {request_username} = require("../../src/session_utils");
const router = require('express').Router();

router.get('/', async (req, res) => {
    const archive = archiver('zip', {});
    archive.on('error', err => res.status(500).send({message: err}));

    const directory =  path.posix.normalize(req.query.directory || '/');
    const connection = await db();
    console.error("DODTODOO")
    const found_files = await connection.query(`SELECT * FROM Fileshare.Files WHERE repos = ${req.repos.id} AND directory IN '${directory}%';`);
    for (const file of Object.values(found_files)) {
        console.error('TODO')
        archive.file(file.storage_path, {name: file.virtual_folder + '/' + decodeURIComponent(file.name)})
    }
    await connection.end();

    logger.info(`Archived '${req.repos.access_key}${directory}' for ${request_username(req)}`)

    res.attachment(`${req.repos.name}.${directory.replaceAll('/', '.')}.zip`.replace(/([^:]\.)\.+/g, "$1"));
    archive.pipe(res);
    await archive.finalize();
});

module.exports = router;