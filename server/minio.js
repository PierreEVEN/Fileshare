const minio = require('minio')
const os = require("os");
const path = require("path");

const minioClient = new minio.Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: true,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});

async function push_file(repos, data_file_path, file) {
    await new Promise((resolve, failed) => {
            minioClient.makeBucket(repos.id.toString(), 'null', (err) => {
                if (err)
                    return failed(err);

                minioClient.fPutObject(repos.id.toString(), file.id, data_file_path, {'Content-Type': file.mimetype, 'File-Name': file.name}, (err, etag) => {
                    if (err)
                        return failed(err)
                    return resolve(etag);
                })
            })
        }
    )
}

async function pop_file(repos, file_id) {
    await new Promise((resolve, failed) => {
            minioClient.makeBucket(repos.id.toString(), 'null', (err) => {
                if (err)
                    return failed(err);
                const output_path =path.combine(os.tempdir(), 'minio_output', file_id);
                minioClient.fGetObject(repos.id.toString(),file_id.toString(), output_path, (err) => {
                    if (err)
                        return failed(err)
                    return resolve(output_path);
                })
            })
        }
    )
}

module.exports = {push_file, pop_file}