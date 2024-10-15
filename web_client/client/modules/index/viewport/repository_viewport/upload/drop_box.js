import {UploadItem} from "./upload_item";
import {MemoryTracker} from "../../../../../types/memory_handler";

require("./drop-box.scss")

/**
 * @type {DropBox}
 */
let CURRENT_INSTANCE = null;

async function drag_enter(event) {
    if (CURRENT_INSTANCE)
        await CURRENT_INSTANCE.drag_enter(event);
}
async function mouse_out(event) {
    if (CURRENT_INSTANCE)
        await CURRENT_INSTANCE.mouse_out(event);
}
async function drag_over(event) {
    if (CURRENT_INSTANCE)
        await CURRENT_INSTANCE.drag_over(event);
}
async function drop(event) {
    if (CURRENT_INSTANCE)
        await CURRENT_INSTANCE.drop(event);
}


class DropBox extends MemoryTracker {
    constructor(box, get_uploader) {
        super(DropBox);
        this.box = box;
        this.get_uploader = get_uploader;
        this.WILL_DROP = null;
        CURRENT_INSTANCE = this;
        document.body.addEventListener('dragenter', drag_enter, )
        document.body.addEventListener('mouseout', mouse_out)
        document.body.addEventListener('dragover', drag_over)
        document.body.addEventListener('drop', drop);

    }

    async drag_enter(event) {
        if (!this.WILL_DROP) {
            this.WILL_DROP = new Promise(async (resolve) => {
                resolve(true);
            })
        }

        event.preventDefault();

        if (!this.WILL_DROP || !await this.WILL_DROP) {
            this.box.classList.add('forbidden');
            return;
        }

        this.box.classList.add('hover');
    }

    async mouse_out(event) {
        this.WILL_DROP = null;
        this.reset_style();
        event.preventDefault();
    }

    async drag_over(event) {
        event.preventDefault();
    }

    async drop(event) {
        this.reset_style();
        event.preventDefault();

        if (!event.dataTransfer) {
            return;
        }

        if (event.dataTransfer.items) {
            const process_entry = async (entry, parent) => {
                if (entry.isDirectory) {
                    const directory = await UploadItem.FromFilesystemDrop(entry);
                    if (parent)
                        parent.add_child(directory);
                    else
                        await this.get_uploader().add_item(directory);
                    entry.createReader().readEntries((entries) => {
                        for (const new_entry of entries)
                            process_entry(new_entry, directory);
                    })
                } else if (entry.isFile) {
                    if (parent)
                        parent.add_child(await UploadItem.FromFilesystemDrop(entry))
                    else
                        await this.get_uploader().add_item(await UploadItem.FromFilesystemDrop(entry))
                }
            }

            [...event.dataTransfer.items].forEach((item, i) => {
                if (item.kind === "file") {
                    const entry = "getAsEntry" in DataTransferItem.prototype ? item.getAsEntry() : item.webkitGetAsEntry();
                    process_entry(entry, null);
                }
            });
        } else {
            [...event.dataTransfer.files].forEach(async (file, _) => {
                this.get_uploader().add_item(await UploadItem.FromFilesystemDrop(file))
            });
        }
    }

    delete() {
        super.delete();
        document.body.removeEventListener('dragenter', drag_enter);
        document.body.removeEventListener('mouseout', mouse_out)
        document.body.removeEventListener('dragover', drag_over)
        document.body.removeEventListener('drop', drop);
        CURRENT_INSTANCE = null;
        this.get_uploader = null;
    }

    reset_style() {
        this.box.classList.remove('hover');
        this.box.classList.remove('forbidden');
    }
}

export {DropBox}