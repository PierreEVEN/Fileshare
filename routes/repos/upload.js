const fs = require("fs");
const {File} = require('../../src/database/files');
const {session_data, public_data, require_connection, request_username} = require("../../src/session_utils");
const conversion_queue = require("../../src/file-conversion");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const {logger} = require("../../src/logger");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (require_connection(req, res))
        return;

    // Or every connected user can upload to this repo, or only it's owner is allowed to
    if (!await req.repos.does_allow_visitor_upload) {
        if (req.repos.owner !== session_data(req).connected_user.id)
            return res.status(401).send(JSON.stringify({
                message: {
                    severity: 'error',
                    title: `Impossible d'envoyer ce fichier`,
                    content: 'Vous n\'avez pas les droits pour mettre en ligne des fichiers sur ce dépôt'
                }
            }))
    }
    next();
})
/* ###################################### CREATE ROUTER ###################################### */

router.get('/', async (req, res) => {
    res.render('repos', {
        title: 'Envoyer un fichier',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        forcer_show_upload: true
    });
});

const upload_in_progress = {};

/**
 * @param file_path
 * @param metadata
 * @param repos {Repos}
 * @param user {User}
 * @returns {Promise<unknown>}
 */
async function received_file(file_path, metadata, repos, user) {
    let path = file_path;
    const meta = metadata;

    switch (metadata.mimetype) {
        case 'video/mpeg':
            await new Promise(resolve => {
                conversion_queue.push_video(file_path, 'mp4', async (new_path) => {
                    path = new_path;
                    meta.mimetype = 'video/mp4';
                    resolve();
                });
            });
            break;
    }

    return await new File({
        repos: repos.id,
        owner: user.id,
        name: meta.file_name,
        description: meta.description,
        mimetype: meta.mimetype,
        directory: meta.directory
    }, file_path).push();
}

router.post('/', async (req, res) => {
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
                file_name: decode_header('name'),
                file_size: decode_header('octets'),
                mimetype: decode_header('mimetype') || '',
                directory: decode_header('directory') || '',
                file_description: decode_header('description'),
                file_id: file_id,
            }
        }
    }

    const tmp_file_path = path.join(os.tmpdir(), file_id);

    req.on('data', chunk => {
        upload_in_progress[file_id].received_size += Buffer.byteLength(chunk);
        fs.appendFileSync(tmp_file_path, chunk);
    })

    req.on('end', async () => {
        if (upload_in_progress[file_id].received_size >= upload_in_progress[file_id].metadata.file_size) {

            logger.info(`${request_username(req)} pushed ${JSON.stringify(upload_in_progress[file_id].metadata)} to ${await req.repos.get_access_key()}`)

            const file = await received_file(tmp_file_path, upload_in_progress[file_id].metadata, req.repos, session_data(req).connected_user)
            delete upload_in_progress[file_id];
            return res.status(202).send(file ? `${file.get_id()}` : '');
        } else if (generated_file_id)
            return res.status(201).send(file_id);
        else
            return res.status(200).send();
    })
});

module.exports = router;