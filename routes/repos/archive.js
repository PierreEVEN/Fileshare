const archiver = require('archiver');
const db = require("../../database");
const path = require("path");
const router = require('express').Router();

router.get('/', async (req, res) => {
    const archive = archiver('zip', {});
    archive.on('error', err => res.status(500).send({message: err}));

    const directory =  path.posix.normalize(req.query.directory || '/');

    const connection = await db();
    const found_files = await connection.query(`SELECT * FROM Personal.Files WHERE repos = ${req.repos.get_id()} AND virtual_folder LIKE '${directory}%';`);
    for (const file of Object.values(found_files))
        archive.file(file.storage_path, {name: file.virtual_folder + '/' + decodeURIComponent(file.name)})
    await connection.end();

    res.attachment(`${await req.repos.get_name()}.${directory.replaceAll('/', '.')}.zip`.replace(/([^:]\.)\.+/g, "$1"));
    archive.pipe(res);
    await archive.finalize();
});

module.exports = router;