const {logger} = require("../../../logger");
const fs = require("fs");
const {Item} = require("../../../database/item");
const {ServerString} = require("../../../server_string");
const {FileConversionQueue, FileConversionHandle} = require("./file-conversion");
const crypto = require("crypto");
const path = require("path");
const {HttpResponse} = require("../../utils/errors");

/**
 * @type {Map<string, FileUpload>}
 */
const UPLOADS_IN_PROGRESS = new Map();

function decode_header(headers, key) {
    try {
        return headers[key] ? decodeURIComponent(headers[key]) : null
    } catch (e) {
        logger.error("Source headers : " + headers[key])
        logger.error(e.toString());
    }
}

class UploadedFileMetadata {
    /**
     * @param headers {object}
     */
    constructor(headers) {
        /**
         * @type {ServerString}
         */
        this.file_name = headers['content-name'] ? ServerString.FromDB(headers['content-name']) : 'ERROR 489784 : INVALID NAME';
        /**
         * @type {Number}
         */
        this.file_size = headers['content-size'] ? Number(headers['content-size']) : 0;
        /**
         * @type {Number}
         */
        this.timestamp = headers['content-timestamp'] ? Number(headers['content-timestamp']) : 0;
        /**
         * @type {ServerString}
         */
        this.mimetype = headers['content-mimetype'] ? ServerString.FromDB(headers['content-mimetype']) : ServerString.FromDB(encodeURIComponent('application/octet-stream'));
        /**
         * @type {ServerString}
         */
        this.virtual_path = headers['content-path'] ? ServerString.FromDB(headers['content-path']) : ServerString.FromDB(encodeURIComponent('/'));
        /**
         * @type {ServerString}
         */
        this.file_description = headers['content-description'] ? ServerString.FromDB(headers['content-description']) : ServerString.FromDB('');
    }
}

class FileUpload {
    /**
     * @param metadata {UploadedFileMetadata}
     */
    constructor(metadata) {
        /**
         * @type {string}
         */
        this.tmp_dir_path = path.join(path.resolve(process.env.FILE_STORAGE_PATH), 'tmp');
        if (!fs.existsSync(this.tmp_dir_path))
            fs.mkdirSync(this.tmp_dir_path, {recursive: true});

        do {
            /**
             * @type {string}
             */
            this.upload_token = crypto.randomBytes(16).toString("hex");
        } while (fs.existsSync(path.join(this.tmp_dir_path, this.upload_token)))

        /**
         * @type {number}
         */
        this.received_size = 0;

        /**
         * @type {UploadedFileMetadata}
         */
        this.metadata = metadata;

        /**
         * @type {Hash}
         */
        this.hash_sum = crypto.createHash('sha256');

        /**
         * @type {string|null}
         */
        this._hashed = null;

        /**
         * @type {number}
         */
        this.processing_status = 0;

        /**
         * @type {string}
         */
        this.tmp_file_path = path.join(this.tmp_dir_path, this.upload_token);

        /**
         * @type {undefined|boolean}
         * @private
         */
        this._search_existing_file = undefined;

        /**
         * @type {undefined|File}
         * @private
         */
        this._found_file_from_data = undefined;

        UPLOADS_IN_PROGRESS.set(this.upload_token, this);
    }

    /**
     * @param upload_token {string}
     * @return {FileUpload}
     */
    static from_token(upload_token) {
        return UPLOADS_IN_PROGRESS.get(upload_token)
    }

    /**
     * @param headers {object}
     * @return {FileUpload}
     */
    static from_headers(headers) {
        if (headers['content-token'])
            return FileUpload.from_token(headers['content-token']);

        return new FileUpload(new UploadedFileMetadata(headers));
    }

    append_bytes(chunk) {
        if (this.metadata.file_size === 0 && Buffer.byteLength(chunk) > 0) {
            return {
                message: "Received data for a file that was announced empty"
            }
        }

        this.received_size += Buffer.byteLength(chunk);
        this.hash_sum.update(chunk);

        if (this.received_size > this.metadata.file_size) {
            return {
                message: "Received to much data : " + this.received_size + " / " + this.metadata.file_size
            }
        }

        try {
            fs.appendFileSync(this.tmp_file_path, chunk);
        } catch (e) {
            console.error("Failed to append bytes : ", e.toString());
            return {
                message: "Failed to append bytes : " + JSON.stringify(e)
            }
        }
        return null;
    }

    clear() {
        if (fs.existsSync(this.tmp_file_path))
            fs.rmSync(this.tmp_file_path);
        UPLOADS_IN_PROGRESS.delete(this.upload_token);
        delete this;
    }

    /**
     * @return {boolean}
     */
    process_file() {
        if (this.file_processing_handle)
            return true;
        const this_ref = this;
        switch (this.metadata.mimetype.plain()) {
            case 'video/mpeg':
                new Promise(resolve => {
                    this_ref.file_processing_handle = new FileConversionHandle(this,async (new_path) => {
                        this_ref.tmp_file_path = new_path;
                        const plain_name = this_ref.metadata.file_name.plain()
                        if (plain_name.toLowerCase().endsWith(".mpg") || plain_name.toLowerCase().endsWith(".mov"))
                            this_ref.metadata.file_name = ServerString.FromURL(plain_name.substring(0, plain_name.length - 3) + "mp4");
                        this_ref.metadata.mimetype = ServerString.FromURL('video/mp4');
                        resolve();
                    }).video(this.tmp_file_path, 'mp4');
                }).then(() => {
                    this_ref.file_processing_handle = null;
                });
                break;
        }
        return !!this.file_processing_handle;
    }

    /**
     * @param repos {Repos}
     * @return {Promise<boolean>}
     */
    async compare_existing_file(repos) {
        if (this.metadata.file_size !== 0) {
            if (this._search_existing_file === undefined) {
                if (!fs.existsSync(this.tmp_file_path)) {
                    console.error("Cannot find local file from path")
                    return false;
                }
                this._search_existing_file = true;
                const this_ref = this;
                const promise = Item.from_data(this_ref.gen_hash(), this_ref.tmp_file_path, repos.id)
                    .then((file_from_data) => {
                        this_ref._found_file_from_data = file_from_data;
                        this_ref._search_existing_file = false;
                    });

                await new Promise(async (resolve) => {
                    let finished = false;
                    setTimeout(() => {
                        if (!finished) {
                            finished = true;
                            resolve();
                        }
                    }, 500);
                    await promise;
                    if (!finished) {
                        finished = true;
                        resolve();
                    }
                });
            }
            return this._search_existing_file === true;
        }
        return false;
    }

    /**
     * @param user {User}
     * @param repo {Repos}
     * @return {Promise<*>}
     */
    async finalize(user, repo) {
        this.processing_status = 1.0;
        if (this.received_size === this.metadata.file_size) {
            logger.info(`${user.name} store '${JSON.stringify(this.metadata)}' to repos '${repo.name}'`)
            if (this._found_file_from_data) {
                logger.warn("A file with the same data already exists")
                this.clear();
                return {
                    error: new HttpResponse(HttpResponse.OK, "A file with the same data already exists"),
                    file: this._found_file_from_data,
                }
            } else {
                const result = await finalize_file_upload(this, repo, user)
                this.clear();
                return result;
            }
        }
    }

    /**
     * @return {string}
     */
    gen_hash() {
        if (this._hashed === null)
            this._hashed = this.hash_sum.digest('hex');
        return this._hashed;
    }
}

/**
 * @param uploading_file {FileUpload}
 * @param repos {Repos}
 * @param user {User}
 * @returns {Promise<unknown>}
 */
async function finalize_file_upload(uploading_file, repos, user) {
    let path = uploading_file.tmp_file_path;
    const meta = uploading_file.metadata;
    let existing_file = null;

    uploading_file.processing_status = 1.0;

    if (uploading_file.metadata.file_size !== 0) {
        if (!fs.existsSync(path)) {
            return {
                error: new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, "Cannot find local file from path"),
                file: null,
            }
        }
        existing_file = await Item.from_path(repos.id, meta.virtual_path + "/" + meta.file_name.encoded());
    }

    if (existing_file) {
        if (!existing_file.is_regular_file) {
            return {
                error: new HttpResponse(HttpResponse.NOT_ACCEPTABLE, "There already is a folder at this path : " + existing_file.absolute_path),
                file: null,
            }
        }
        logger.warn(`File ${JSON.stringify(meta)} with the same name already exists, but with different data inside. Replacing with new one`);
        if (uploading_file.metadata.file_size !== 0)
            fs.renameSync(path, existing_file.storage_path());
        existing_file.size = meta.file_size;
        existing_file.hash = uploading_file.gen_hash();
        existing_file.mimetype = new ServerString(meta.mimetype);
        existing_file.timestamp = meta.timestamp;
        // If the item already exists, move out of the trash
        if (existing_file.in_trash) {
            existing_file.parent_item = (await Item.find_or_create_directory_from_path(repos.id, meta.virtual_path.plain(), {owner: user.id}));
            existing_file.in_trash = false;
        }
        await existing_file.push();
        console.info(`File ${meta.file_name} with the same name already exists, but with different data inside. Replacing with new one`)
        return {
            error: null,
            file: existing_file,
        }
    }

    try {
        const parent_item = (await Item.find_or_create_directory_from_path(repos.id, meta.virtual_path.plain(), {owner: user.id}));
        const file_meta = await new Item({
            repos: repos.id,
            owner: user.id,
            is_regular_file: true,
            name: meta.file_name.encoded(),
            description: meta.file_description.encoded(),
            mimetype: meta.mimetype.encoded(),
            size: meta.file_size,
            parent_item: parent_item.wanted_directory ? parent_item.wanted_directory.id : null,
            hash: uploading_file.gen_hash(),
            timestamp: meta.timestamp,
        }).push();

        if (uploading_file.metadata.file_size !== 0)
            fs.renameSync(path, file_meta.storage_path());

        return {
            error: null,
            warn: null,
            file: file_meta,
            created_directories: parent_item.created_directories,
        }
    } catch (error) {
        return {
            error: new HttpResponse(HttpResponse.INTERNAL_SERVER_ERROR, 'file insertion failed : ' + JSON.stringify(error)),
            file: null,
        }
    }
}

module.exports = {FileUpload}