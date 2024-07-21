/***********************************************************************************************/
/*                                         REPOS                                               */
/***********************************************************************************************/

const {
    get_common_data,
    require_connection,
} = require("../../../session_utils");
const {logger} = require("../../../logger");
const {display_name_to_url} = require("../../../database/tools/db_utils");
const path = require("path");
const fs = require("fs");
const {FileUpload} = require("./upload");
const sharp = require("sharp");
const {platform} = require("os");
const gm = require("gm");
const ffmpeg = require("fluent-ffmpeg");
const {Item} = require("../../../database/item");
const {HttpResponse} = require("../../utils/errors");
const {ServerString} = require("../../../server_string");
const {ServerPermissions} = require("../../../permissions");
const router = require("express").Router();
const archiver = require('archiver');
const json_compress = require('compress-json')

/********************** [GLOBAL] **********************/
router.use('/', async (req, res, next) => {
    if (!req.display_repos)
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown repository").redirect_error(req, res);

    if (!await ServerPermissions.can_user_view_repos(req.display_repos, req.connected_user ? req.connected_user.id : null)) {
        // This user is not allowed to access this repos
        return new HttpResponse(HttpResponse.NOT_FOUND, "Unknown repository").redirect_error(req, res);
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
    const time_a = performance.now()
    let data = await req.display_repos.get_content();
    const time_b = performance.now()
    json_compress.trimUndefinedRecursively(data)
    const time_c = performance.now()
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name} : Fetch : ${time_b - time_a}ms, Trim : ${time_c - time_b}ms`)
    return res.send(data);
})

router.get("/content/:id", async (req, res) => {
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name}`)

    // Search the requested file or dir
    if (Number.isNaN(Number(req.params['id'])))
        return new HttpResponse(HttpResponse.BAD_REQUEST, "The provided object id is not valid").redirect_error(req, res);
    const item = await Item.from_id(req.params['id']);
    if (!item || !await ServerPermissions.can_user_access_item(item, req.connected_user ? req.connected_user.id : null))
        return new HttpResponse(HttpResponse.NOT_FOUND, "The requested file or directory does not exists or is not accessible").redirect_error(req, res);
    if (item.is_regular_file)
        await item.as_file();
    else
        await item.as_directory();

    return res.send(item);
})

router.get("/file", async (req, res) => {
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name}`)

    // Search the requested file or dir
    if (!await ServerPermissions.can_user_view_repos(req.display_repos, req.connected_user ? req.connected_user.id : null))
        return new HttpResponse(HttpResponse.NOT_FOUND, "The requested file or directory does not exists or is not accessible").redirect_error(req, res);

    const items = await req.display_repos.get_content();
    const archive = archiver('zip', {});
    for (const file of items) {
        if (file.is_regular_file)
            archive.file(file.storage_path(), {name: (file.parent_item ? (await Item.from_id(file.parent_item)).absolute_path.plain() : '') + "/" + file.name.plain()})
    }

    logger.info(`Archiving '${req.display_repos.display_name}/' for ${req.connected_user ? req.connected_user.name : 'Unknown user'} ...`)
    res.attachment(`${req.display_repos.name.encoded()}.zip`);
    archive.on('error', err => {
        logger.error('Archive failed :', err.toString())
        res.status(500).send({message: err})
    });
    archive.pipe(res);
    await archive.finalize();
})

router.get("/file/:id", async (req, res) => {
    logger.info(`${req.log_name} fetch content of ${req.display_user.name}/${req.display_repos.name} : ${req.params['id']}`)

    // Search the requested file or dir
    if (Number.isNaN(Number(req.params['id'])))
        return new HttpResponse(HttpResponse.BAD_REQUEST, "The provided object id is not valid").redirect_error(req, res);
    const item = await Item.from_id(req.params['id']);
    if (!item || !await ServerPermissions.can_user_access_item(item, req.connected_user ? req.connected_user.id : null))
        return new HttpResponse(HttpResponse.NOT_FOUND, "The requested file or directory does not exists or is not accessible").redirect_error(req, res);

    if (item.is_regular_file) {
        // Send file in response
        const file_path = item.storage_path();

        if (!fs.existsSync(file_path))
            return new HttpResponse(HttpResponse.GONE, "The requested resource was removed from this server").redirect_error(req, res);

        res.setHeader('Content-Type', `${item.mimetype}`)
        res.setHeader('Content-Disposition', 'inline; filename=' + item.name.encoded());
        return res.sendFile(path.resolve(file_path));
    } else {
        let files = await item.get_files_inside_recursive();
        const archive = archiver('zip', {});

        for (const file of files) {
            archive.file(file.storage_path(), {name: (await Item.from_id(file.parent_item)).absolute_path.plain() + "/" + file.name.plain()})
        }

        logger.info(`Archiving '${req.display_repos.display_name.plain()}/${item.absolute_path.plain()}' for ${req.connected_user ? req.connected_user.name : 'Unknown user'} ...`)

        res.attachment(`${item.name.encoded()}.zip`);
        archive.on('error', err => {
            logger.error('Archive failed :', err.toString())
            res.status(500).send({message: err})
        });
        archive.pipe(res);
        await archive.finalize();
    }
})

router.post('/update/:id', async function (req, res, _) {
    // Search the requested file or dir
    if (Number.isNaN(Number(req.params['id'])))
        return new HttpResponse(HttpResponse.BAD_REQUEST, "The provided object id is not valid").redirect_error(req, res);
    const item = await Item.from_id(req.params['id']);
    if (!item || !await ServerPermissions.can_user_edit_item(item, req.connected_user.id))
        return new HttpResponse(HttpResponse.NOT_FOUND, "The requested file or directory does not exists or is not accessible").redirect_error(req, res);

    if (item.is_regular_file) {
        await item.as_file()
    } else {
        await item.as_directory()
        item.open_upload = req.body.open_upload;
    }
    item.name = new ServerString(req.body.name);
    item.description = new ServerString(req.body.description);
    await item.push();

    logger.warn(`${req.log_name} updated file ${item.id}`);
    return res.sendStatus(HttpResponse.OK);
});

router.post('/update/', async function (req, res, _) {
    if (!await ServerPermissions.can_user_configure_repos(req.display_repos, req.connected_user.id))
        return new HttpResponse(HttpResponse.FORBIDDEN, "You don't have the required authorizations to edit this repository").redirect_error(req, res);

    req.display_repos.name = ServerString.FromURL(display_name_to_url(new ServerString(req.body.name).plain()));

    req.display_repos.description = new ServerString(req.body.description);
    req.display_repos.display_name = new ServerString(req.body.display_name);
    if (!req.display_repos.name || !req.display_repos.display_name || !req.display_repos.description)
        return new HttpResponse(HttpResponse.BAD_REQUEST, "Invalid repository name").redirect_error(req, res);
    req.display_repos.status = req.body.status;
    req.display_repos.max_file_size = req.body.max_file_size;
    req.display_repos.visitor_file_lifetime = req.body.guest_file_lifetime;
    req.display_repos.allow_visitor_upload = req.body.allow_visitor_upload === 'on';

    await req.display_repos.push();
    logger.warn(`${req.log_name} updated repos ${req.display_repos.access_key}`)
    return res.sendStatus(HttpResponse.OK);
});

router.post('/remove/:id', async (req, res) => {

    // Search the requested file or dir
    if (Number.isNaN(Number(req.params['id'])))
        return new HttpResponse(HttpResponse.BAD_REQUEST, "The provided object id is not valid").redirect_error(req, res);
    const item = await Item.from_id(req.params['id']);
    if (!item || !await ServerPermissions.can_user_edit_item(item, req.connected_user.id))
        return new HttpResponse(HttpResponse.NOT_FOUND, "You don't have the required authorizations to delete this file").redirect_error(req, res);

    await item.delete();

    logger.warn(`${req.log_name} deleted file ${item.name}:${item.id}`);
    return res.sendStatus(HttpResponse.OK);
});

router.post('/delete/', async (req, res) => {
    if (require_connection(req, res))
        return;

    if (req.display_repos.owner !== req.connected_user.id)
        return new HttpResponse(HttpResponse.FORBIDDEN, "You don't have the required authorizations to delete this repository").redirect_error(req, res);

    await req.display_repos.delete();
    logger.warn(`${req.log_name} deleted repos ${req.display_repos.access_key}`)
    res.redirect(`/`);
});

router.post('/send/*', async (req, res) => {

    // @TODO Allow user to upload to a specific directory with specific upload permissions
    if (!await ServerPermissions.can_user_upload_to_repos(req.display_repos, req.connected_user.id))
        return new HttpResponse(HttpResponse.FORBIDDEN, "You don't have the required authorizations to upload files here").redirect_error(req, res);

    let uploading_file = FileUpload.from_headers(req.headers);
    if (!uploading_file) {
        console.warn("Cannot upload : the current stream doesn't exists on the server");
        return new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, "Cannot upload : the current stream doesn't exists on the server").redirect_error(req, res);
    }

    let sent_response = false;

    req.on('data', chunk => {
        // If null, the connection have already been interrupted
        if (uploading_file) {
            const error = uploading_file.append_bytes(chunk);
            if (error && !sent_response) {
                console.warn("Upload failed : ", error.message);
                uploading_file.clear();
                new HttpResponse(HttpResponse.NOT_ACCEPTABLE, error.message).redirect_error(req, res);
                sent_response = true;
            }
        }
    })

    req.on('end', async () => {
        // If null, the connection have already been interrupted
        if (uploading_file) {
            if (uploading_file.received_size === uploading_file.metadata.file_size) { // Finished
                // Should we require a conversion step
                if (uploading_file.process_file()) {
                    res.status(200).send({
                        stream_id: uploading_file.upload_token,
                        process_percent: uploading_file.processing_status
                    })
                } else if (await uploading_file.compare_existing_file(req.display_repos)) {
                    res.status(200).send({
                        stream_id: uploading_file.upload_token,
                        process_percent: 0.99
                    })
                } else {
                    const result = await uploading_file.finalize(req.connected_user, req.display_repos);
                    if (result.error && result.error.status_code !== HttpResponse.OK)
                        return result.error.redirect_error(req, res);
                    if (!result.file)
                        return new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, "Invalid file data : unhandled error case").redirect_error(req, res);
                    res.status(200).send({
                        stream_id: uploading_file.upload_token,
                        process_percent: uploading_file.processing_status,
                        file_id: result.file.id,
                        message: result.error ? result.error.response_message : ""
                    })
                    uploading_file.clear();
                }
            } else {
                if (sent_response)
                    return;
                sent_response = true;
                return res.status(200).send({
                    stream_id: uploading_file.upload_token,
                    process_percent: uploading_file.processing_status
                })
            }
        }
    })
});

router.get('/thumbnail/:id', async function (req, res) {

        if (!fs.existsSync('./data_storage/thumbnails'))
            fs.mkdirSync('./data_storage/thumbnails');

        const file = await Item.from_id(req.params['id']);
        if (!file || !file.is_regular_file)
            return new HttpResponse(HttpResponse.NOT_ACCEPTABLE, "The requested object is not a regular file").redirect_error(req, res);

        if (!await ServerPermissions.can_user_access_item(file, req.connected_user ? req.connected_user.id : null))
            return new HttpResponse(HttpResponse.NOT_FOUND, "The requested file or directory does not exists or is not accessible").redirect_error(req, res);

        await file.as_file();

        const thumbnail_path = `data_storage/thumbnails/${file.id}`

        res.setHeader('Content-Disposition', 'attachment; filename=thumbnail_' + file.name.encoded());

        const file_path = file.storage_path()

        if (!fs.existsSync(thumbnail_path)) {
            const mimetype = file.mimetype.plain();
            if (mimetype.startsWith('image/')) {
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
            } else if (mimetype.includes('pdf')) {
                // Doesn't work on windows
                if (platform() === 'win32')
                    return res.sendFile(path.resolve('public/images/icons/mime-icons/application/pdf.png'));
                await new Promise(async (resolve) => {
                    gm(path.resolve(file_path + '')) // The name of your pdf
                        .setFormat("jpg")
                        .resize(100) // Resize to fixed 200px width, maintaining aspect ratio
                        .quality(70) // Quality from 0 to 100
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
            } else if (mimetype.startsWith('video/')) {
                let filename = null;

                new ffmpeg(file_path)
                    .on('filenames', async (filenames) => {
                        filename = filenames[0]
                    })
                    .on('end', async () => {
                        logger.info(`generated video thumbnail for ${file.id} (${file.name})`)
                        if (!fs.existsSync(`data_storage/thumbnails/dir_${file.id}/${filename}`)) {
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

router.post('/make-directory', async (req, res) => {
    if (!await ServerPermissions.can_user_upload_to_repos(req.display_repos, req.connected_user.id))
        return new HttpResponse(HttpResponse.FORBIDDEN, "You don't have the required authorizations to create directory here").redirect_error(req, res);

    const name = new ServerString(req.body.name);
    const new_dir = await Item.create_directory(req.display_repos.id, req.connected_user.id, null, name, req.body.open_upload);
    if (new_dir && new_dir.id)
        return new HttpResponse(HttpResponse.OK).redirect_error(req, res);
    return new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, "Directory or file already exists").redirect_error(req, res);

})

router.post('/make-directory/:id', async (req, res) => {
    const parent = Item.from_id(req.params['id'])

    if (parent.is_regular_file)
        return new HttpResponse(HttpResponse.FORBIDDEN, "Cannot create directory inside file").redirect_error(req, res);

    if (!parent || !await ServerPermissions.can_user_upload_to_directory(parent, req.connected_user.id))
        return new HttpResponse(HttpResponse.FORBIDDEN, "You don't have the required authorizations to create directory here").redirect_error(req, res);

    const name = new ServerString(req.body.name);
    const new_dir = await Item.create_directory(req.display_repos.id, req.connected_user.id, parent, name, req.body.open_upload);
    if (new_dir && new_dir.id)
        return new HttpResponse(HttpResponse.OK).redirect_error(req, res);
    return new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, "Directory or file already exists").redirect_error(req, res);

})

router.use('/permissions/', require('./permissions/root'))

module.exports = router;