const formidable = require("formidable");
const fs= require("fs");
const session_utils = require('../../src/session_utils')
const Files = require('../../src/database/tables/files')
const Users = require('../../src/database/tables/user')
const Repos = require('../../src/database/tables/repos')

async function view(req, res) {
    if (session_utils.require_connection(req, res))
        return

    const found_repos = await Repos.find_access_key(req.params.repos);

    res.render('fileshare/fileshare', {
        title: 'Envoyer un fichier',
        user: req.session.user,
        forcer_show_upload: true,
        current_repos: await found_repos.public_data(true),
    });
}

async function post_upload(req, res) {
    if (session_utils.require_connection(req, res))
        return

    console.log("received A")
    const form = new formidable.IncomingForm({maxFileSize: 100000 * 1024 * 1024});
    console.log("received B")
    await form.parse(req, async function(err, fields, files){

        console.log("received C :", files)
        console.log("received C ERR :", err)
        for(const file in files) {
            const file_data = files[file][0];
            if(!files.hasOwnProperty(file)) continue;

            console.log("received ", file)

            if (!fs.existsSync('./data_storage/')){
                fs.mkdirSync('./data_storage/');
            }
            await Files.insert(file_data.filepath, await Repos.find_access_key(req.params.repos), await Users.find(req.session.user.id), file_data.originalFilename, "not available", file_data.mimetype, "/")
        }
        res.redirect(`/fileshare/repos/${req.params.repos}`);
    });
}


module.exports = {view, post_upload};