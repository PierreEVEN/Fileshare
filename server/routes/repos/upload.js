const fs = require("fs");
const {File} = require('../../database/files');
const {session_data, public_data, require_connection, request_username, error_403} = require("../../session_utils");
const conversion_queue = require("../../file-conversion");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const {logger} = require("../../logger");
const {Directories} = require("../../database/directories");
const perms = require("../../permissions");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (require_connection(req, res))
        return;

    next();
})
/* ###################################### CREATE ROUTER ###################################### */

router.get('/', async (req, res) => {
    if (!await perms.can_user_upload_to_repos(req['repos'], req['user'].id)) {
        return error_403(req, res);
    }

    res.render('repos', {
        title: 'Envoyer un fichier',
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        force_show_upload: true
    });
});

const upload_in_progress = {};

/**
 * @param file_path
 * @param metadata
 * @param repos {Repos}
 * @param user {User}
 * @param file_hash
 * @returns {Promise<unknown>}
 */
async function received_file(file_path, metadata, repos, user, file_hash) {
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

    const existing_file = await File.from_data(file_hash, file_path, repos.id);
    if (existing_file) {
        logger.warn(`File ${metadata} already exists in this repository - skipping`);
        return null;
    }

    const parent_directory = (await Directories.find_or_create(repos.id, meta.virtual_path, {owner: user.id}));

    const file_meta = await new File({
        repos: repos.id,
        owner: user.id,
        name: meta.file_name,
        description: meta.description,
        mimetype: meta.mimetype,
        size: meta.file_size,
        parent_directory: parent_directory ? parent_directory.id : null,
        hash: file_hash,
        timestamp: meta.timestamp,
    }).push();
    fs.renameSync(file_path, file_meta.storage_path());
    return file_meta;
}

router.post('/', async (req, res) => {
    const decode_header = (key) => {
        return req.headers[key] ? decodeURIComponent(req.headers[key]) : null
    }

    let file_id = decode_header('content-id'); // null if this was the first chunk
    let generated_file_id = false;
    if (!file_id) {
        do {
            file_id = crypto.randomBytes(16).toString("hex");
        } while (fs.existsSync(path.join(os.tmpdir(), file_id)))
        generated_file_id = true;
        upload_in_progress[file_id] = {
            received_size: 0,
            metadata: {
                file_name: decode_header('content-name'),
                file_size: decode_header('content-size'),
                mimetype: decode_header('content-mimetype') || '',
                virtual_path: decode_header('content-path') || '/',
                file_description: decode_header('content-description'),
                file_id: file_id,
                timestamp: decode_header('timestamp'),
            },
            hash_sum: crypto.createHash('sha256'),
        }
    }

    if (!await perms.can_user_upload_to_repos(req['repos'], req['user'].id)) {
        let valid = false;
        const dir = await Directories.from_path(req.repos.id, upload_in_progress[file_id].metadata.virtual_path);
        if (!dir) {
            valid = false;
        }
        else if (await perms.can_user_upload_to_directory(dir, req.user.id)) {
            valid = true;
        }

        if (!valid) {
            delete upload_in_progress[file_id];
            return error_403(req, res);
        }
    }

    const tmp_file_path = path.join(os.tmpdir(), file_id);

    req.on('data', chunk => {
        upload_in_progress[file_id].received_size += Buffer.byteLength(chunk);
        upload_in_progress[file_id].hash_sum.update(chunk)
        fs.appendFileSync(tmp_file_path, chunk);
    })

    req.on('end', async () => {
        if (upload_in_progress[file_id].received_size >= upload_in_progress[file_id].metadata.file_size) {
            logger.info(`${request_username(req)} store '${JSON.stringify(upload_in_progress[file_id].metadata)}' to repos '${req.repos.access_key}'`)
            const file = await received_file(tmp_file_path, upload_in_progress[file_id].metadata, req.repos, session_data(req).connected_user, upload_in_progress[file_id].hash_sum.digest('hex'))
            delete upload_in_progress[file_id];
            return res.status(202).send(file ? `${file.id}` : '');
        } else if (generated_file_id)
            return res.status(201).send(file_id);
        else {
            return res.status(200).send();
        }
    })
});

module.exports = router;