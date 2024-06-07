/***********************************************************************************************/
/*                                         REPOS                                               */
/***********************************************************************************************/

const {
    get_common_data,
    error_404,
    require_connection,
    error_403,
    public_data,
    events
} = require("../../../session_utils");
const perms = require("../../../permissions");
const permissions = require("../../../permissions");
const {logger} = require("../../../logger");
const {display_name_to_url, as_data_string} = require("../../../db_utils");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {upload_in_progress, finalize_file_upload} = require("./utils");
const sharp = require("sharp");
const {platform} = require("os");
const gm = require("gm");
const ffmpeg = require("fluent-ffmpeg");
const {Item} = require("../../../database/item");
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
    req.request_path = req.url.substring(5);
    res.render('repos', {
        title: `FileShare - ${req.display_repos.name}`,
        common: await get_common_data(req)
    });
})

router.get("/content/", async (req, res) => {
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name}`)

    // Path is empty or is equal to '/' => return a json with the whole hierarchy
    return res.send(await req.display_repos.get_content());
})

router.get("/content/:id", async (req, res) => {
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name}`)

    // Search the requested file or dir
    const item = await Item.from_id(req.params['id']);
    if (!item)
        return error_404(req, res, `Le fichier ou dossier ${req.params['id']} n'existe pas`);

    if (item.is_regular_file) {
        await item.as_file();
    }
    else
        await item.as_directory();

    // Path is empty or is equal to '/' => return a json with the whole hierarchy
    return res.send(item);
})

router.get("/file/:id", async (req, res) => {
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name} : ${req.params['id']}`)

    // Search the requested file or dir
    const item = await Item.from_id(req.params['id']);
    if (!item)
        return error_404(req, res, `Le fichier ou dossier ${req.params['id']} n'existe pas`);

    if (!await permissions.can_user_view_file(item, req.connected_user ? req.connected_user.id : null)) {
        return error_404(req, res, `Le fichier ou dossier ${req.params['id']} n'existe pas`);
    }

    if (item.is_regular_file) {
        // Send file in response
        const file_path = item.storage_path();

        if (!fs.existsSync(file_path))
            return error_404(req, res, 'Document introuvable');

        res.setHeader('Content-Type', `${item.mimetype}`)
        res.setHeader('Content-Disposition', 'inline; filename=' + encodeURIComponent(item.name));
        return res.sendFile(path.resolve(file_path));
    } else {
        return error_404(req, res, `l'element ${item.id} n'est pas un fichier`);
    }
})

router.get("/can-upload/", async (req, res) => {
    if (req.connected_user && req.display_repos) {
        if (await permissions.can_user_upload_to_repos(req.display_repos, req.connected_user.id))
            return res.sendStatus(200)
    }
    res.sendStatus(204);
});

router.get("/can-upload/:id", async (req, res) => {
    if (req.params['id']) {
        if (!Number.isInteger(req.params['id']))
            return error_404(req, res);
        const directory = await Item.from_id(req.params['id']);
        if (directory) {
            if (req.connected_user && req.display_repos) {
                if (await permissions.can_user_upload_to_directory(directory, req.connected_user.id))
                    return res.sendStatus(200);
            }
        }
    } else {
        if (req.connected_user && req.display_repos) {
            if (await permissions.can_user_upload_to_repos(req.display_repos, req.connected_user.id))
                return res.sendStatus(200)
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
router.get("/can-edit/:id", async (req, res) => {
    const file = await Item.from_id(req.params['id']);
    if (file) {
        if (req.connected_user && req.display_repos) {
            if (await permissions.can_user_edit_item(file, req.connected_user.id))
                return res.sendStatus(200);
        }
    }
    res.sendStatus(204);
})

router.post('/update/:id', async function (req, res, _) {

    const item = await Item.from_id(req.params['id']);


    if (!await perms.can_user_edit_item(item, req.connected_user.id))
        return error_403(req, res, 'Accès non autorisé');

    if (item.is_regular_file) {
        await item.as_file()
    }
    else {
        await item.as_directory()
        item.open_upload = req.body.open_upload;
    }
    item.name = encodeURIComponent(req.body.name);
    item.description = encodeURIComponent(req.body.description);
    await item.push();

    logger.warn(`${req.log_name} updated file ${item.id}`);
    return res.redirect(`/${req.display_user.name}/${req.display_repos.name}/`);
});

router.post('/update/', async function (req, res, _) {
    if (require_connection(req, res))
        return;

    if (!await perms.can_user_edit_repos(req.display_repos, req.connected_user.id))
        return error_403(req, res, 'Vous n\'avez pas les droits pour modifier ce dépot');

    req.display_repos.name = encodeURIComponent(display_name_to_url(req.body.name));
    if (!req.display_repos.name)
        return error_403(req, res, 'Url de dépot invalide');
    req.display_repos.description = encodeURIComponent(req.body.description);
    req.display_repos.display_name = encodeURIComponent(req.body.display_name);
    req.display_repos.status = req.body.status;
    req.display_repos.max_file_size = req.body.max_file_size;
    req.display_repos.visitor_file_lifetime = req.body.guest_file_lifetime;
    req.display_repos.allow_visitor_upload = req.body.allow_visitor_upload === 'on';

    await req.display_repos.push();
    logger.warn(`${req.log_name} updated repos ${req.display_repos.access_key}`)
    return res.redirect(`/${req.display_user.name}/${req.display_repos.name}/`);
});

router.post('/remove/:id', async (req, res) => {
    if (require_connection(req, res))
        return;

    const item = await Item.from_id(req.params['id']);

    if (!item || !await permissions.can_user_edit_item(item, req.connected_user.id))
        return error_404(req, res, "forbidden");

    await item.delete();

    logger.warn(`${req.log_name} deleted file ${item.name}:${item.id}`);
    res.sendStatus(200);
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

router.post('/send/*', async (req, res) => {
    const tmp_dir_path = path.join(path.resolve(process.env.FILE_STORAGE_PATH), 'tmp');
    if (!fs.existsSync(tmp_dir_path))
        fs.mkdirSync(tmp_dir_path, {recursive: true});

    if (!await perms.can_user_upload_to_repos(req.display_repos, req.connected_user.id)) {
        return error_403(req, res);
    }

    const decode_header = (key) => {
        try {
            return req.headers[key] ? decodeURIComponent(req.headers[key]) : null
        } catch (e) {
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
    if (generated_transfer_token && upload_in_progress[transfer_token].metadata.file_size === 0)
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
            return res.status(file ? (file.already_exists ? 409 : 202) : 400).send(file ? {
                status: "Finished",
                file_id: file.id
            } : {status: "Failed"});
        } else if (upload_in_progress[transfer_token].received_size > upload_in_progress[transfer_token].metadata.file_size)
            return res.status(413).send({status: "Overflow"});
        else if (generated_transfer_token)
            return res.status(201).send({status: "Partial-init", "content-token": transfer_token});
        else {
            return res.status(200).send({status: "Partial-continue"});
        }
    })
});

router.get('/thumbnail/:id', async function (req, res) {

        if (!fs.existsSync('./data_storage/thumbnails'))
            fs.mkdirSync('./data_storage/thumbnails');

        const file = await Item.from_id(req.params['id']);
        if (!file || !file.is_regular_file)
            return error_404(req, res);

        if (!await permissions.can_user_view_file(file, req.connected_user ? req.connected_user.id : null)) {
            return error_404(req, res, `Le fichier ou dossier ${req.params['id']} n'existe pas`);
        }

        await file.as_file();

        const thumbnail_path = `data_storage/thumbnails/${file.id}`

        res.setHeader('Content-Disposition', 'attachment; filename=thumbnail_' + encodeURIComponent(file.name));

        const file_path = file.storage_path()

        if (!fs.existsSync(thumbnail_path)) {
            if ((file.mimetype).startsWith('image/')) {
                sharp(file_path).resize(100, 100, {
                    fit: 'inside',
                    withoutEnlargement: true,
                    fastShrinkOnLoad: true,
                }).withMetadata()
                    .toFile(thumbnail_path, async (err, _) => {
                        if (err) {
                            logger.error(`failed to generate thumbnail for ${file.id} (${file.name}) : ${JSON.stringify(err)}`);
                            return res.sendFile(path.resolve(file_path));
                        } else {
                            logger.info(`generated thumbnail for ${file.id} (${file.name})`);
                            return res.sendFile(path.resolve(thumbnail_path));
                        }
                    });
            } else if ((file.mimetype).includes('pdf')) {
                // Doesn't work on windows
                if (platform() === 'win32')
                    return res.sendFile(path.resolve('public/images/icons/mime-icons/application/pdf.png'));
                await new Promise(async (resolve) => {
                    gm(path.resolve(file_path + '')) // The name of your pdf
                        .setFormat("jpg")
                        .resize(200) // Resize to fixed 200px width, maintaining aspect ratio
                        .quality(75) // Quality from 0 to 100
                        .write(thumbnail_path, async error => {
                            // Callback function executed when finished
                            if (!error) {
                                logger.info(`generated thumbnail for ${file.id} (${file.name})`);
                                resolve();
                            } else {
                                logger.error(`failed to generate thumbnail for ${file.id} (${file.name}) : ${JSON.stringify(error)}`);
                                return res.sendFile(path.resolve(file_path));
                            }
                        });
                });

                return res.sendFile(path.resolve(thumbnail_path));
            } else if ((file.mimetype).startsWith('video/')) {
                let filename = null;

                new ffmpeg(file_path)
                    .on('filenames', async (filenames) => {
                        filename = filenames[0]
                    })
                    .on('end', async () => {
                        logger.info(`generated video thumbnail for ${file.id} (${file.name})`)
                        if (!fs.existsSync(`data_storage/thumbnails/dir_${req.file.id}/${filename}`)) {
                            logger.error(`Failed to get path to generated thumbnail : 'data_storage/thumbnails/dir_${file.id}/${filename}'`);
                            return res.sendFile(path.resolve(file_path));
                        }
                        fs.renameSync(`data_storage/thumbnails/dir_${file.id}/${filename}`, thumbnail_path);
                        fs.rmdirSync(`data_storage/thumbnails/dir_${file.id}`)
                        return res.sendFile(path.resolve(thumbnail_path));
                    })
                    .on('error', async (err) => {
                        logger.error(`Failed generated video thumbnail for ${file.id} (${file.name}) : ${JSON.stringify(err)}`);
                        return res.sendFile(path.resolve(file_path));
                    })
                    .takeScreenshots({
                        count: 1,
                        timemarks: ['0'],
                        size: '100x100'
                    }, `data_storage/thumbnails/dir_${file.id}`);
            } else
                return res.sendFile(path.resolve(file_path));
        } else
            return res.sendFile(path.resolve(thumbnail_path));
    }
)


module.exports = router;