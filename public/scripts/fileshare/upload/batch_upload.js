import {parse_fetch_result, print_message} from "../utils.js";

async function upload_batch(batch, on_progress) {
    for (const file of batch) {
        await send_file_by_chunks(file, (progress) => on_progress(file, progress));
    }
}

async function send_file_by_chunks(file, on_progress) {
    let start = 0;
    let end = Math.min(file.size, 200 * 1024 * 1024);
    let index = 0;
    let finished = false;

    const metadata = {
        file_name: file.name,
        file_size: file.size,
        mimetype: file.mimetype,
        virtual_path: file.virtual_path,
        file_description: file.description,
        file_id: null,
    };

    do {
        const blob = file.slice(start, end);
        const res = await try_send_chunk(blob, metadata, index, (sent) => on_progress(sent + start));
        if (res.status === 201)
            metadata.file_id = res.response;

        if (res.status === 200 || res.status === 201) {
            if (start >= file.size) {
                console.log("Server sent wrong result ! :", res)
                finished = true;
                continue;
            }

            start = end;
            end = Math.min(end + 200 * 1024 * 1024, file.size)
        } else if (res.status === 202) {
            finished = true;
        } else {
            await parse_fetch_result(res);
            finished = true;
        }
    } while (!finished);
    console.log("fini");
}

async function try_send_chunk(data, metadata, index, on_progress) {
    // Create request
    const req = new XMLHttpRequest();
    const result_promise = new Promise((resolve) => {
        req.onreadystatechange = () => {
            const is_quick = req.status === 200 || req.status === 202;
            if (req.readyState === 2 && is_quick) // message received (only for 201 response)
                resolve(req);
            if (req.readyState === 4 && !is_quick) // header received
                resolve(req);
        }
    })

    req.upload.addEventListener("progress", (event) => on_progress(event.loaded));
    req.open("POST", `/fileshare/repos/${current_repos.access_key}/upload`);

    for (const [key, value] of Object.entries(metadata)) {
        if (value) {
            req.setRequestHeader(key, encodeURIComponent(value));
        }
    }

    req.send(data);
    return result_promise;
}

export {upload_batch}