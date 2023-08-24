const formidable = require("formidable");
const fs= require("fs");
const session_utils = require('../../src/session_utils')
const Files = require('../../src/database/tables/files')
const Repos = require('../../src/database/tables/repos')
const {session_data, error_403, public_data, error_404} = require("../../src/session_utils");
const conversion_queue = require("../../src/file-conversion");

async function view(req, res) {
    if (session_utils.require_connection(req, res))
        return

    const repos = await Repos.find_access_key(req.params.repos)
    if (!repos)
        return error_404(req, res);

    // Or every connected user can upload to this repo, or only it's owner is allowed to
    if (!await repos.does_allow_visitor_upload()) {
        if ((await repos.get_owner()).get_id() !== await session_data(req).connected_user.get_id())
            return error_403(req, res, "Vous n'avez pas les droits pour mettre en ligne des fichiers sur ce dépôt");
    }

    session_data(req).select_repos(repos);

    res.render('fileshare/repos', {
        title: 'Envoyer un fichier',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        forcer_show_upload: true,
    });
}

async function post_upload(req, res) {
    if (session_utils.require_connection(req, res))
        return

    const repos = await Repos.find_access_key(req.params.repos)

    // Or every connected user can upload to this repo, or only it's owner is allowed to
    if (!await repos.does_allow_visitor_upload()) {
        if ((await repos.get_owner()).get_id() !== session_data(req).connected_user.get_id())
            return error_403(req, res, "Vous n'avez pas les droits pour mettre en ligne des fichiers sur ce dépôt");
    }

    session_data(req).select_repos(repos);
    console.warn("todo : prevent max upload size")
    const form = new formidable.IncomingForm({maxFileSize: 100000 * 1024 * 1024});
    await form.parse(req, async function(err, fields, files){
        for(const file in files) {
            const file_data = files[file][0];
            let meta_data = fields['metadata_file' + file_data.originalFilename];
            if (meta_data)
                meta_data = JSON.parse(meta_data[0]);

            if(!files.hasOwnProperty(file)) continue;

            if (!fs.existsSync('./data_storage/'))
                fs.mkdirSync('./data_storage/');

            const mime_type = meta_data.mimetype ? meta_data.mimetype : file_data.mimetype;

            if (mime_type === 'video/mpeg') {
                conversion_queue.push_video(file_data.filepath, 'mp4', async (new_path) => {
                    const result = await Files.insert(new_path, await Repos.find_access_key(req.params.repos), session_data(req).connected_user, file_data.originalFilename, meta_data ? meta_data.description : "", 'video/mp4', meta_data ? meta_data.virtual_path : "/")
                    if (!result)
                        console.warn(`A file with the same name already exists : ${file_data.originalFilename}`)
                    await events.on_upload_file(repos)
                })
            }
            else {
                const result = await Files.insert(file_data.filepath, await Repos.find_access_key(req.params.repos), session_data(req).connected_user, file_data.originalFilename, meta_data ? meta_data.description : "", mime_type, meta_data ? meta_data.virtual_path : "/")
                if (!result)
                    console.warn(`A file with the same name already exists : ${file_data.originalFilename}`)
            }
        }
        await events.on_upload_file(repos)

        res.redirect(`/fileshare/repos/${req.params.repos}`);
    });
}

module.exports = {view, post_upload};