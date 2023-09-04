const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const {error_404, session_data} = require("../src/session_utils");
const Files = require("../src/database/tables/files");

/* ###################################### CREATE ROUTER ###################################### */
const router = require('express').Router();
router.use(async (req, res, next) => {
    if (!req.query.file) {
        if (session_data(req).selected_repos)
            res.redirect(`/repos/?repos=${await session_data(req).selected_repos.get_access_key()}`);
        else
            res.redirect(`/`);
    }

    const file = await Files.find(req.query.file);
    if (!file)
        return error_404(req, res, 'Document inexistant');

    const file_path = `./${await file.get_storage_path()}`

    if (!fs.existsSync(file_path))
        return error_404(req, res, 'Document introuvable');

    req.file = file;
    req.file_path = file_path;

    next();
})
/* ###################################### CREATE ROUTER ###################################### */

router.get('/', async function (req, res) {
    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(await req.file.get_name()));
    return res.sendFile(path.resolve(req.file_path));
})

router.get('/thumbnail', async function (req, res) {
        if (!fs.existsSync('./data_storage/thumbnail'))
            fs.mkdirSync('./data_storage/thumbnail');

        const thumbnail_path = `data_storage/thumbnail/${req.file.get_id()}`

        res.setHeader('Content-Disposition', 'attachment; filename=thumbnail_' + await req.file.get_name());

        if (!fs.existsSync(thumbnail_path)) {
            if ((await req.file.get_mimetype()).startsWith('image/')) {
                sharp(req.file_path).resize(100, 100, {
                    fit: 'inside',
                    withoutEnlargement: true,
                    fastShrinkOnLoad: true,
                }).withMetadata()
                    .toFile(thumbnail_path, async (err, resizeImage) => {
                        if (err) {
                            console.error(`failed to generate thumbnail for ${req.file.get_id()} (${await req.file.get_name()}) :`, err);
                            return res.sendFile(path.resolve(req.file_path));
                        } else {
                            console.info(`generated thumbnail for ${req.file.get_id()} (${await req.file.get_name()})`);
                            return res.sendFile(path.resolve(thumbnail_path));
                        }
                    });
            } else if ((await req.file.get_mimetype()).startsWith('video/')) {
                let filename = null;

                new ffmpeg(req.file_path)
                    .on('filenames', async (filenames) => {
                        filename = filenames[0]
                    })
                    .on('end', async () => {
                        console.info(`generated video thumbnail for ${req.file.get_id()} (${await req.file.get_name()})`)
                        fs.renameSync(`data_storage/thumbnail/dir_${req.file.get_id()}/${filename}`, thumbnail_path);
                        fs.rmdirSync(`data_storage/thumbnail/dir_${req.file.get_id()}`)
                        return res.sendFile(path.resolve(thumbnail_path));
                    })
                    .on('error', async (err) => {
                        console.error(`Failed generated video thumbnail for ${req.file.get_id()} (${await req.file.get_name()}) :`, err);
                        return res.sendFile(path.resolve(req.file_path));
                    })
                    .takeScreenshots({
                        count: 1,
                        timemarks: ['0'],
                        size: '100x100'
                    }, `data_storage/thumbnail/dir_${req.file.get_id()}`);
            } else
                return res.sendFile(path.resolve(req.file_path));
        } else
            return res.sendFile(path.resolve(thumbnail_path));
    }
)

module.exports = router;