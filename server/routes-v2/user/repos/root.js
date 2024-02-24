/***********************************************************************************************/
/*                                         REPOS                                               */
/***********************************************************************************************/

const {get_common_data, error_404, require_connection, error_403, public_data, events, session_data} = require("../../../session_utils");
const {Repos} = require("../../../database/repos");
const perms = require("../../../permissions");
const permissions = require("../../../permissions");
const {logger} = require("../../../logger");
const assert = require("assert");
const {display_name_to_url} = require("../../../db_utils");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {upload_in_progress, finalize_file_upload} = require("./utils");
const {File} = require("../../../database/files");
const {Directories} = require("../../../database/directories");
const router = require("express").Router();

/********************** [GLOBAL] **********************/
router.use('/', async (req, res, next) => {
    if (!req.display_repos)
        return error_404(req, res);

    if (!await perms.can_user_view_repos(req.display_repos, req.connected_user ? req.connected_user.id : null)) {
        // Redirect to signin page if user is not connected
        if (!req.connected_user)
            return require_connection(req, res);

        // This user is not allowed to access this repos
        return error_403(req, res);
    }

    next();
});
/********************** [GLOBAL] **********************/


router.get("/", async (req, res) => {
    res.render('repos', {
        title: `FileShare - ${req.display_repos.name}`,
        common: await get_common_data(req),
    });
})

router.get("/tree/*", async (req, res) => {
    req.display_repos.display_path = res.url;
    res.render('repos', {
        title: `FileShare - ${req.display_repos.name}`,
        common: await get_common_data(req),
    });
})

router.get('/file/*', async function (req, res) {
    const search_path = req.url.substring(5);
    logger.info(`${req.log_name} downloaded ${search_path}`)
    if (search_path.length <= 1)
        res.sendStatus(404, 'Chemin non valide');

    const file = await File.from_path(req.display_repos.id, search_path);
    if (!file)
        return error_404(req, res, 'Document inexistant');

    const file_path = file.storage_path()

    if (!fs.existsSync(file_path))
        return error_404(req, res, 'Document introuvable');

    res.setHeader('Content-Type', `${file.mimetype}`)
    res.setHeader('Content-Disposition', 'inline; filename=' + encodeURIComponent(file.name));
    return res.sendFile(path.resolve(file_path));
})

router.get("/data", async (req, res) => {

    res.send(await req.display_repos.get_tree());

})

router.get("/can-upload/", async (req, res) => {
    if (req.connected_user && req.display_repos) {
        if (await permissions.can_user_upload_to_repos(req.display_repos, req.connected_user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})

router.get("/can-upload/*", async (req, res) => {
    const path = req.url.substring(11);
    if (path.length > 1) {
        const directory = await Directories.from_path(req.display_repos.id, path);
        if (directory) {
            if (req.connected_user && req.display_repos) {
                if (await permissions.can_user_upload_to_directory(directory, req.connected_user.id))
                    return res.sendStatus(200);
            }
        }
    }
    res.sendStatus(204);
})

router.get("/can-edit/", async (req, res) => {
    if (req.connected_user && req.display_repos) {
        if (await permissions.can_user_edit_repos(req.display_repos, req.connected_user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
})
router.get("/can-edit/*", async (req, res) => {
    const path = req.url.substring(9);
    if (path.length > 1) {
        const file = await File.from_path(req.display_repos.id, path);
        if (file) {
            if (req.connected_user && req.display_repos) {
                if (await permissions.can_user_edit_file(file, req.connected_user.id))
                    return res.sendStatus(200);
            }
        }
        else {
            const directory = await Directories.from_path(req.display_repos.id, path);
            if (directory) {
                if (req.connected_user && req.display_repos) {
                    if (await permissions.can_user_edit_directory(directory, req.connected_user.id))
                        return res.sendStatus(200);
                }
            }
        }
    }
    res.sendStatus(204);
})

router.post('/update/', async function (req, res, _) {
    if (require_connection(req, res))
        return;

    if (!await perms.can_user_edit_repos(req.display_repos, req.connected_user.id))
        return error_403(req, res, 'Vous n\'avez pas les droits pour modifier ce dépot');

    req.display_repos.name = display_name_to_url(req.body.name);
    if (!req.display_repos.name)
        return error_403(req, res, 'Url de dépot invalide');
    req.display_repos.description = req.body.description;
    if (req.display_repos.status !== req.body.status) {
        if (req.display_repos.status === 'public' || req.body.status === 'public')
            public_data().mark_dirty();
        req.display_repos.status = req.body.status;
        await events.on_update_repos(req.display_repos);
    }

    req.display_repos.display_name = req.body.display_name;

    req.display_repos.max_file_size = req.body.max_file_size;
    req.display_repos.visitor_file_lifetime = req.body.guest_file_lifetime;
    req.display_repos.allow_visitor_upload = req.body.allow_visitor_upload === 'on';

    req.display_repos.push();
    logger.warn(`${req.log_name} updated repos ${req.display_repos.access_key}`)
    return res.redirect(`/${req.display_user.name}/${req.display_repos.name}/`);
});

router.post('/delete/', async (req, res) => {
    if (require_connection(req, res))
        return;

    if (req.display_repos.owner !== req.connected_user.id)
        return error_403(req, res, "Seul le possesseur d'un dépot peut le supprimer");

    await req.display_repos.delete();
    logger.warn(`${req.log_name} deleted repos ${req.display_repos.access_key}`)
    res.redirect(`/`);
});

router.post('/send', async (req, res) => {
    const tmp_dir_path = path.join(path.resolve(process.env.FILE_STORAGE_PATH), 'tmp');
    if (!fs.existsSync(tmp_dir_path))
        fs.mkdirSync(tmp_dir_path, {recursive: true});

    if (!await perms.can_user_upload_to_repos(req.display_repos, req.connected_user.id)) {
        return error_403(req, res);
    }

    const decode_header = (key) => {
        try {
            return req.headers[key] ? decodeURIComponent(req.headers[key]) : null
        }
        catch (e) {
            logger.error("Source headers : " + req.headers[key])
            logger.error(e.toString());
        }
    }

    let transfer_token = decode_header('content-token'); // null if this was the first chunk
    let generated_transfer_token = false;
    // If no transfer token was found, initialize a file transfer
    if (!transfer_token) {
        do {
            transfer_token = crypto.randomBytes(16).toString("hex");
        } while (fs.existsSync(path.join(tmp_dir_path, transfer_token)))
        generated_transfer_token = true;
        upload_in_progress[transfer_token] = {
            received_size: 0,
            metadata: {
                file_name: decode_header('content-name'),
                file_size: Number(decode_header('content-size')),
                timestamp: decode_header('content-timestamp'),
                mimetype: decode_header('content-mimetype') || 'application/octet-stream',
                virtual_path: decode_header('content-path') || '/',
                file_description: decode_header('content-description'),
                file_id: transfer_token,
            },
            hash_sum: crypto.createHash('sha256'),
        }
    }

    const tmp_file_path = path.join(tmp_dir_path, transfer_token);
    // Create and store empty file if size is zero
    if (upload_in_progress[transfer_token].metadata.file_size === 0)
        fs.closeSync(fs.openSync(tmp_file_path, 'w'));

    req.on('data', chunk => {
        upload_in_progress[transfer_token].received_size += Buffer.byteLength(chunk);
        upload_in_progress[transfer_token].hash_sum.update(chunk)
        fs.appendFileSync(tmp_file_path, chunk);
    })

    req.on('end', async () => {
        if (upload_in_progress[transfer_token].received_size === upload_in_progress[transfer_token].metadata.file_size) {
            logger.info(`${req.log_name} store '${JSON.stringify(upload_in_progress[transfer_token].metadata)}' to repos '${req.display_repos.name}'`)
            const file = await finalize_file_upload(tmp_file_path, upload_in_progress[transfer_token].metadata, req.display_repos, req.connected_user, upload_in_progress[transfer_token].hash_sum.digest('hex'))
            delete upload_in_progress[transfer_token];
            return res.status(file ? 202 : 400).send(file ? {status: "Finished", file_id: file.id} : {status: "Failed"});
        } else if (upload_in_progress[transfer_token].received_size > upload_in_progress[transfer_token].metadata.file_size)
            return res.status(413).send({status: "Overflow"});
        else if (generated_transfer_token)
            return res.status(201).send({status: "Partial-init", "content-token": transfer_token});
        else {
            return res.status(200).send({status: "Partial-continue"});
        }
    })
});



module.exports = router;