const conversion_queue = require("../../../file-conversion");
const {logger} = require("../../../logger");
const fs = require("fs");
const {as_data_string} = require("../../../db_utils");
const {Item} = require("../../../database/item");

const upload_in_progress = {};

/**
 * @param file_path
 * @param metadata
 * @param repos {Repos}
 * @param user {User}
 * @param file_hash
 * @returns {Promise<unknown>}
 */
async function finalize_file_upload(file_path, metadata, repos, user, file_hash) {
    let path = file_path;
    const meta = metadata;

    switch (metadata.mimetype) {
        case 'video/mpeg':
            await new Promise(resolve => {
                conversion_queue.push_video(file_path, 'mp4', async (new_path) => {
                    path = new_path;
                    if (meta.file_name.toLowerCase().endsWith(".mpg"))
                        meta.file_name = meta.file_name.substring(0, meta.file_name.length - 3) + "mp4"
                    meta.mimetype = 'video/mp4';
                    resolve();
                });
            });
            break;
    }

    const parent_item = (await Item.find_or_create_directory_from_path(repos.id, meta.virtual_path, {owner: user.id}));
    // Ensure the file doesn't already exists
    let existing_file = await Item.from_path(repos.id, meta.virtual_path + "/" + encodeURIComponent(meta.file_name));
    if (await Item.from_data(file_hash, path, repos.id)) {
        logger.error("A file with the same data already exists")
        return null;
    }

    if (existing_file) {
        if (!existing_file.is_regular_file) {
            logger.error("There already is a folder at this path")
            return null;
        }
        logger.warn(`File ${JSON.stringify(metadata)} with the same name already exists, but with different data inside. Replacing with new one`);
        fs.renameSync(path, existing_file.storage_path());
        existing_file.size = meta.file_size;
        existing_file.hash = file_hash;
        existing_file.mimetype = encodeURIComponent(meta.mimetype);
        existing_file.timestamp = meta.timestamp;
        await existing_file.push();
        return existing_file;
    }

    try {
        const file_meta = await new Item({
            repos: repos.id,
            owner: user.id,
            is_regular_file: true,
            name: encodeURIComponent(meta.file_name),
            description: encodeURIComponent(meta.description),
            mimetype: encodeURIComponent(meta.mimetype),
            size: meta.file_size,
            parent_item: parent_item ? parent_item.id : null,
            hash: file_hash,
            timestamp: meta.timestamp,
        }).push();

        fs.renameSync(path, file_meta.storage_path());
        return file_meta;
    }
    catch (error) {
        logger.error('file insertion failed : ', error);
        return null;
    }
}

module.exports = {finalize_file_upload, upload_in_progress}