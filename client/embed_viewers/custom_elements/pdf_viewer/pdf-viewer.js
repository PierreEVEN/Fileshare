class PdfViewer extends HTMLElement {
    constructor() {
        super();
        this.style.backgroundColor = '#f5f5f5';
        this.style.color = '#262626';
        this.style.width = '100%';
        this.style.height = '100%';
        this.style.maxHeight = '100%';

        if (!this.hasAttribute('src'))
            return;

        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;
        this.scale = 0.8;
        const this_ref = this;

        const display = require('./pdf-viewer.hbs')({}, {
            'page_next': () => {
                this.ask_for_page(this.pageNum + 1);
            },
            'page_prev': () => {
                this.ask_for_page(this.pageNum + 1);
            },
            'zoom': () => {
                this.zoom(this.scale * 1.2);
            },
            'dezoom': () => {
                this.zoom(this.scale / 1.2);
            }
        });

        this.canvas = display.getElementsByTagName('canvas')[0]
        this.attachShadow({mode: 'open'}).append(display);

        import("./pdfjsdist_loader").then(pdfjs => {
                pdfjs.get_pdf_js_dist().getDocument(this.getAttribute('src'))
                    .promise
                    .then(function (pdfDocument) {
                        this_ref.pdfDoc = pdfDocument;
                        this_ref.render_page(1);
                    })
            });
    }
    zoom(new_level) {
        this.scale = new_level;
        if (!this.pageNumPending)
            this.render_page(this.pageNum);
    }
    ask_for_page(number) {
        if (this.pageRendering)
            this.pageNumPending = number;
        else
            this.render_page(number);
    }

    render_page(page_number) {
        this.pageNum = page_number;
        const this_ref = this;
        return this.pdfDoc.getPage(this.pageNum).then(function (pdfPage) {
            // Display page on the existing canvas with 100% scale.
            const viewport = pdfPage.getViewport({scale: this_ref.scale});
            this_ref.canvas.width = viewport.width;
            this_ref.canvas.height = viewport.height;
            const ctx = this_ref.canvas.getContext("2d");
            const renderTask = pdfPage.render({
                canvasContext: ctx,
                viewport,
            });
            this_ref.pageRendering = true;
            return renderTask.promise.then(function () {
                this_ref.pageRendering = false;
                if (this_ref.pageNumPending !== null) {
                    this_ref.render_page(this_ref.pageNumPending);
                    this_ref.pageNumPending = null;
                }
            });
        });
    }
}

customElements.define("pdf-embed", PdfViewer);