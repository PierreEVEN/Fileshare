const ffmpeg = require('fluent-ffmpeg');
const {logger} = require("../../../logger");

class FileConversionHandle {
    /**
     * @param owner {FileUpload}
     * @param on_success
     */
    constructor(owner, on_success) {
        this.on_success = on_success;
        this.owner = owner;
    }

    video(path, new_format) {
        this.path = path;
        this.new_format = new_format;
        FileConversionQueue.push_video(this);
        return this;
    }
}


class FileConversionQueue {
    constructor() {
        /**
         * @type {FileConversionHandle[]}
         */
        this.video_conversion_queue = []
    }

    /**
     * @param handle {FileConversionHandle}
     */
    static push_video(handle) {
        logger.info(`Pushed new video for conversion '${handle.path}' to ${handle.new_format}`);
        conversion_queue.video_conversion_queue.push(handle);
        conversion_queue.proc_next_video()
    }

    proc_next_video() {
        if (this.video_conversion_queue.length === 0)
            return;

        const next_proc = this.video_conversion_queue[this.video_conversion_queue.length - 1];
        this.video_conversion_queue.pop();
        const this_ref = this;

        new ffmpeg({source: next_proc.path})
            .toFormat(next_proc.new_format)
            .on('end', function () {
                logger.info(`Finished video conversion from '${next_proc.path}' to ${next_proc.new_format}`);
                next_proc.on_success(next_proc.path + '_converted');
                this_ref.proc_next_video();
            })
            .on('progress', logProgress => {
                next_proc.owner.processing_status = logProgress.percent / 100;
            })
            .on('error', function (err) {
                logger.error(`Failed to convert video '${next_proc.path}' to ${next_proc.new_format} : ${JSON.stringify(err)}`);
                this_ref.proc_next_video();
            })
            .saveToFile(next_proc.path + '_converted');
    }

    static async get_video_meta_data(file_path) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(file_path, (err, meta) => {
                if (err)
                    reject(err);
                resolve(meta)
            })
        })
    }
}

const conversion_queue = new FileConversionQueue();

module.exports = {FileConversionQueue, FileConversionHandle}