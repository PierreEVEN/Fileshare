const conversion_queue = require("../../../file-conversion");
const {logger} = require("../../../logger");
const fs = require("fs");
const {as_data_string} = require("../../../db_utils");

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
        // TODO Handle data conversion with client
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

    const parent_directory = (await Directories.find_or_create(repos.id, meta.virtual_path, {owner: user.id}));

    // Ensure the file doesn't already exists
    const existing_file = await File.from_path(repos.id, meta.virtual_path + "/" + meta.file_name);
    if (existing_file) {
        logger.warn(`File ${JSON.stringify(metadata)} with the same name already exists, but with different data inside. Replacing with new one`);
        fs.renameSync(file_path, existing_file.storage_path());
        existing_file.size = meta.file_size;
        existing_file.hash = file_hash;
        existing_file.mimetype = meta.mimetype;
        existing_file.timestamp = meta.timestamp;
        await existing_file.push();
        return existing_file;
    }

    try {
        const file_meta = await new File({
            repos: repos.id,
            owner: user.id,
            name: as_data_string(meta.file_name),
            description: as_data_string(meta.description),
            mimetype: meta.mimetype,
            size: meta.file_size,
            parent_directory: parent_directory ? parent_directory.id : null,
            hash: file_hash,
            timestamp: meta.timestamp,
        }).push();

        fs.renameSync(file_path, file_meta.storage_path());
        return file_meta;
    }
    catch (error) {
        logger.error('file insertion failed : ' + error);
        return null;
    }
}

module.exports = {finalize_file_upload, upload_in_progress}