const fs = require("fs");
const Files = require('../../src/database/tables/files');
const {session_data, public_data, require_connection, request_username} = require("../../src/session_utils");
const conversion_queue = require("../../src/file-conversion");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const {logger} = require("../../logger");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (require_connection(req, res))
        return;

    // Or every connected user can upload to this repo, or only it's owner is allowed to
    if (!await req.repos.does_allow_visitor_upload()) {
        if ((await req.repos.get_owner()).get_id() !== session_data(req).connected_user.get_id())
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

router.get('/', async(req, res) => {
    res.render('repos', {
        title: 'Envoyer un fichier',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        forcer_show_upload: true
    });
});

const upload_in_progress = {};

async function received_file(file_path, metadata, repos, user) {

    if (metadata.mimetype === 'video/mpeg') {
        return await new Promise(resolve=> {

            conversion_queue.push_video(file_path, 'mp4', async (new_path) => {
                const result = await Files.insert(new_path, repos, user, metadata.file_name, metadata.description, 'video/mp4', metadata.virtual_path)
                if (!result) {
                    logger.warn(`Failed to insert file : ${metadata.file_name}`)
                    resolve(null);
                }
                else {
                    await events.on_upload_file(repos)
                    resolve(result);
                }
            });
        });
    } else {
        const result = await Files.insert(file_path, repos, user, metadata.file_name, metadata.description, metadata.mimetype, metadata.virtual_path)
        if (!result)
            logger.warn(`Failed to insert file : ${metadata.file_name}`)
        return result;
    }
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
                file_name: decode_header('file_name'),
                file_size: decode_header('file_size'),
                mimetype: decode_header('mimetype') || '',
                virtual_path: decode_header('virtual_path') || '',
                file_description: decode_header('file_description'),
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
            res.status(202).send(file ? `${file.get_id()}` : '');
        } else if (generated_file_id)
            res.status(201).send(file_id);
        else
            res.status(200).send();
    })
});

module.exports = router;