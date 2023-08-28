const formidable = require("formidable");
const fs = require("fs");
const session_utils = require('../../src/session_utils')
const Files = require('../../src/database/tables/files')
const Repos = require('../../src/database/tables/repos')
const {session_data, error_403, public_data, error_404} = require("../../src/session_utils");
const conversion_queue = require("../../src/file-conversion");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

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

const upload_in_progress = {};

async function received_file(file_path, metadata, repos, user) {

    if (metadata.mimetype === 'video/mpeg') {
        conversion_queue.push_video(file_path, 'mp4', async (new_path) => {
            const result = await Files.insert(new_path, repos, user, metadata.file_name, metadata.description, 'video/mp4', metadata.virtual_path)
            if (!result)
                console.warn(`Failed to insert file : ${metadata.file_name}`)
            await events.on_upload_file(repos)
        })
    } else {
        const result = await Files.insert(file_path, repos, user, metadata.file_name, metadata.description, metadata.mimetype, metadata.virtual_path)
        if (!result)
            console.warn(`Failed to insert file : ${metadata.file_name}`)
    }
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

    const decode_header = (key) => {
        return req.headers[key] ? decodeURIComponent(req.headers[key]) : null
    }

    let file_id = decode_header('file_id'); // null if this was the first chunk
    let generated_file_id = false;
    if (!file_id) {
        do {
            file_id = crypto.randomBytes(16).toString("hex");
        } while (fs.existsSync(path.join(os.tmpdir(), file_id)))
        generated_file_id = true;
        upload_in_progress[file_id] = {
            received_size: 0,
            metadata: {
                file_name: decode_header('file_name'),
                file_size: decode_header('file_size'),
                mimetype: decode_header('mimetype') || '',
                virtual_path: decode_header('virtual_path') || '',
                file_description: decode_header('file_description'),
                file_id: file_id,
            }
        }
        console.log("received :", upload_in_progress[file_id].metadata, req.headers['mimetype'], decode_header('mimetype'))
    }

    const tmp_file_path = path.join(os.tmpdir(), file_id);

    req.on('data', chunk => {
        upload_in_progress[file_id].received_size += Buffer.byteLength(chunk);
        fs.appendFileSync(tmp_file_path, chunk);
    })

    req.on('end', () => {
        if (upload_in_progress[file_id].received_size >= upload_in_progress[file_id].metadata.file_size) {
            res.status(202).send();

            received_file(tmp_file_path, upload_in_progress[file_id].metadata, repos, session_data(req).connected_user)
            delete upload_in_progress[file_id];
        } else if (generated_file_id)
            res.status(201).send(file_id);
        else
            res.status(200).send();
    })
}

module.exports = {view, post_upload};