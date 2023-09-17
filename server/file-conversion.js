const ffmpeg = require('fluent-ffmpeg');
const {logger} = require("./logger");

class FileConversionQueue {
    constructor() {
        this.video_conversion_queue = []
    }

    push_video(path, new_format, on_success) {
        logger.info(`Pushed new video for conversion '${path}' to ${new_format}`);
        this.video_conversion_queue.push({path: path, new_format: new_format, on_success: on_success});
        this.proc_next_video()
    }

    proc_next_video() {
        if (this.video_conversion_queue.length === 0)
            return;

        const next_proc = this.video_conversion_queue[this.video_conversion_queue.length - 1];
        this.video_conversion_queue.pop();
        const this_ref = this;

        new ffmpeg({ source: next_proc.path})
            .toFormat(next_proc.new_format)
            .on('end', function() {
                logger.info(`Finished video conversion from '${next_proc.path}' to ${next_proc.new_format}`);
                next_proc.on_success(next_proc.path + '_converted');
                this_ref.proc_next_video();
            })
            .on('error', function(err) {
                logger.error(`Failed to convert video '${next_proc.path}' to ${next_proc.new_format} : ${JSON.stringify(err)}`);
                this_ref.proc_next_video();
            })
            .saveToFile(next_proc.path + '_converted');
    }
}

const conversion_queue = new FileConversionQueue();

module.exports = conversion_queue