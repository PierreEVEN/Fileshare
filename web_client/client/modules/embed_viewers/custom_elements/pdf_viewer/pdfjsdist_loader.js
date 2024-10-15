const pdfjsLib = require("pdfjs-dist");
pdfjsLib.GlobalWorkerOptions.workerSrc = "../../../dist/pdf_worker.js";

function get_pdf_js_dist() {
    return pdfjsLib;
}

export {get_pdf_js_dist}