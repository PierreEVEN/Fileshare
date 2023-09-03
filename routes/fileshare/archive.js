const Repos = require("../../src/database/tables/repos");
const {error_404, session_data, error_403} = require("../../src/session_utils");
const archiver = require('archiver');
const db = require("../../database");
const path = require("path");

async function view(req, res) {
    const repos = await Repos.find_access_key(req.params.repos);

    // Verify access
    if (!repos)
        return error_404(req, res);
    if (!await repos.can_user_read_repos(session_data(req).connected_user))
        return error_403(req, res);

    const archive = archiver('zip', {});
    archive.on('error', err => res.status(500).send({message: err}));

    const directory =  path.posix.normalize(req.query.directory || '/');

    const connection = await db();
    const found_files = await connection.query(`SELECT * FROM Personal.Files WHERE repos = ${repos.get_id()} AND virtual_folder LIKE '${directory}%';`);
    for (const file of Object.values(found_files))
        archive.file(file.storage_path, {name: file.virtual_folder + '/' + decodeURIComponent(file.name)})
    await connection.end();

    res.attachment(`${await repos.get_name()}.${directory.replaceAll('/', '.')}.zip`.replace(/([^:]\.)\.+/g, "$1"));
    archive.pipe(res);
    await archive.finalize();
}

module.exports = {view};