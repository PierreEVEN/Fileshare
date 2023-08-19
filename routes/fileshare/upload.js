const formidable = require("formidable");
const fs = require("fs");
const db = require("../../database");
const crypto = require("crypto");
const session_utils = require('../../src/session_utils')
const Files = require('../../src/database/tables/files')
const Users = require('../../src/database/tables/user')
const Repos = require('../../src/database/tables/repos')

function view(req, res) {
    if (session_utils.require_connection(req, res))
        return

    console.log("fazfazf")
    res.render('fileshare/upload', {
        title: 'Envoyer un fichier',
        user: req.session.user
    });
}

async function post_upload(req, res) {
    if (session_utils.require_connection(req, res))
        return

    const form = new formidable.IncomingForm();

    await form.parse(req, async function(err, fields, files){

        for(const file in files) {
            const file_data = files[file][0];
            //console.log("file : ", file_data)
            if(!files.hasOwnProperty(file)) continue;
            const old = file_data.filepath;

            if (!fs.existsSync('./data_storage/')){
                fs.mkdirSync('./data_storage/');
            }

            await Files.insert(file_data.filepath, await Repos.find(req.params.repos), await Users.find(req.session.user.id), file_data.originalFilename, "not available", file_data.mimetype, "/")
        }
        res.redirect(`/fileshare/repos/${req.params.repos}`);
    });
}


module.exports = {view, post_upload};