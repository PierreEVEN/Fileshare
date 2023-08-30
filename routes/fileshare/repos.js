const express = require('express');
const router = express.Router();
const Repos = require('../../src/database/tables/repos')
const Files = require('../../src/database/tables/files')
const session_utils = require("../../src/session_utils");
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require("fluent-ffmpeg")

// Upload
const upload = require("./upload");
const {error_404, error_403, session_data, public_data} = require("../../src/session_utils");
const fs = require("fs");
router.get('/:repos/upload', upload.view)
router.post('/:repos/upload', upload.post_upload);

router.get('/:repos', async function (req, res, next) {

    const found_repos = await Repos.find_access_key(req.params.repos);
    if (!found_repos)
        return error_404(req, res);

    // If repos is private, request connexion and ensure the user is the owner
    if (await found_repos.get_status() === 'private') {
        if (session_utils.require_connection(req, res))
            return;

        if ((await found_repos.get_owner()).get_id() !== session_data(req).connected_user.get_id()) {
            return error_403(req, res)
        }
    }

    await session_data(req).select_repos(found_repos);

    res.render('fileshare/repos', {
        title: `FileShare - ${await found_repos.get_name()}`,
        session_data: await session_data(req).client_data(),
        public_data: await public_data().get(),
        mime: require('mime')
    });
});

router.get('/:repos/content', async function (req, res, next) {

    const found_repos = await Repos.find_access_key(req.params.repos);
    if (!found_repos)
        return error_404(req, res);

    // If repos is private, request connexion and ensure the user is the owner
    if (await found_repos.get_status() === 'private') {
        if (session_utils.require_connection(req, res))
            return;

        if ((await found_repos.get_owner()).get_id() !== session_data(req).connected_user.get_id()) {
            return error_403(req, res)
        }
    }

    await session_data(req).select_repos(found_repos);

    res.json(await found_repos.public_data(true));
});

router.get('/:repos/file/:file/', async function (req, res) {
    if (!req.params.repos || !req.params.file) {
        return error_404(req, res, "Paramètre manquant");
    }

    const found_repos = await Repos.find_access_key(req.params.repos);
    if (!found_repos)
        return error_404(req, res, "Ce dépôt n'existe pas");

    // If repos is private, request connexion and ensure the user is the owner
    if (await found_repos.get_status() === 'private') {
        if (session_utils.require_connection(req, res))
            return;

        if ((await found_repos.get_owner()).get_id() !== session_data(req).connected_user.get_id()) {
            return error_403(req, res)
        }
    }

    const file = await Files.find(req.params.file)

    if (!file)
        return error_404(req, res, "Pas de fichier à cette adresse");

    res.setHeader('Content-Disposition', 'attachment; filename=' + await file.get_name());

    const file_path = `./${await file.get_storage_path()}`

    if (fs.existsSync(file_path)) {
        return res.sendFile(path.resolve(file_path))
    } else
        return error_404(req, res, "Document introuvable");
})


router.get('/:repos/file/:file/thumbnail', async function (req, res) {

        if (!req.params.repos || !req.params.file) {
            return error_404(req, res, "Paramètre manquant");
        }

        const found_repos = await Repos.find_access_key(req.params.repos);
        if (!found_repos)
            return error_404(req, res, "Ce dépôt n'existe pas");

        // If repos is private, request connexion and ensure the user is the owner
        if (await found_repos.get_status() === 'private') {
            if (session_utils.require_connection(req, res))
                return;

            if ((await found_repos.get_owner()).get_id() !== session_data(req).connected_user.get_id()) {
                return error_403(req, res)
            }
        }

        const file = await Files.find(req.params.file)

        if (!file)
            return error_404(req, res, "Pas de fichier à cette adresse");

        res.setHeader('Content-Disposition', 'attachment; filename=thumbnail_' + await file.get_name());

        if (!fs.existsSync('./data_storage/thumbnail'))
            fs.mkdirSync('./data_storage/thumbnail');

        const file_path = await file.get_storage_path()

        if (!fs.existsSync(file_path))
            return error_404(req, res, "Document introuvable");

        const thumbnail_path = `data_storage/thumbnail/${file.get_id()}`

        if (!fs.existsSync(thumbnail_path)) {
            if ((await file.get_mimetype()).startsWith('image/')) {
                sharp(file_path).resize(100, 100, {
                    fit: 'inside',
                    withoutEnlargement: true,
                    fastShrinkOnLoad: true,
                }).withMetadata()
                    .toFile(thumbnail_path, async (err, resizeImage) => {
                        if (err) {
                            console.error(`failed to generate thumbnail for ${file.get_id()} (${await file.get_name()}) :`, err);
                            return res.sendFile(path.resolve(file_path));
                        } else {
                            console.info(`generated thumbnail for ${file.get_id()} (${await file.get_name()})`);
                            return res.sendFile(path.resolve(thumbnail_path));
                        }
                    });
            } else if ((await file.get_mimetype()).startsWith('video/')) {
                let filename = null;

                new ffmpeg(file_path)
                    .on('filenames', async (filenames) => {
                        filename = filenames[0]
                    })
                    .on('end', async () => {
                        console.info(`generated video thumbnail for ${file.get_id()} (${await file.get_name()})`)
                        fs.renameSync(`data_storage/thumbnail/dir_${file.get_id()}/${filename}`, thumbnail_path);
                        fs.rmdirSync(`data_storage/thumbnail/dir_${file.get_id()}`)
                        return res.sendFile(path.resolve(thumbnail_path));
                    })
                    .on('error', async (err) => {
                        console.error(`Failed generated video thumbnail for ${file.get_id()} (${await file.get_name()}) :`, err);
                        return res.sendFile(path.resolve(file_path));
                    })
                    .takeScreenshots({
                        count: 1,
                        timemarks: ['0'],
                        size: '100x100'
                    }, `data_storage/thumbnail/dir_${file.get_id()}`);
            } else
                return res.sendFile(path.resolve(file_path));
        } else
            return res.sendFile(path.resolve(thumbnail_path));
    }
)

module.exports = router;