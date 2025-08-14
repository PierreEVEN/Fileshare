require('./pdf_viewer.scss')
const {NOTIFICATION, Message} = require("../../../index/tools/message_box/notification");

class PdfViewer extends HTMLElement {
    constructor() {
        super();
        if (!this.hasAttribute('src'))
            return;

        this.preload_range = 3;

        /**
         * @type {PDFDocumentProxy}
         */
        this.pdf_doc = null;

        /**
         * @type {Map<number, Object>}
         * @private
         */
        this._pages = new Map();

        /**
         * @type {number[]}
         * @private
         */
        this._page_render_pool = [];
    }

    connectedCallback() {
        const display = require('./pdf-viewer.hbs')({}, {
            'page_next': () => {
            },
            'page_prev': () => {
            },
            'zoom': () => {
                this.mark_pages_dirty();
                this.set_zoom(this._zoom * 1.2);
            },
            'dezoom': () => {
                this.mark_pages_dirty();
                this.set_zoom(this._zoom / 1.2);
            }
        });
        this._elements = display.hb_elements;
        for (const element of display)
            this.append(element);
        this._set_loading(true, false);
        import("./pdfjsdist_loader").then(pdfjs => {
            pdfjs.get_pdf_js_dist().getDocument(this.getAttribute('src'))
                .promise
                .then((pdf_document) => {
                    this._set_loading(true, true);
                    this.init_document(pdf_document);
                })
        });

        this._elements.container.onscroll = () => {
            this.generate_pages_in_view();
        }
    }

    _set_loading(loading, soon) {
        if (!loading) {
            if (this._loading_div) {
                this._loading_div.remove();
                delete this._loading_div;
            }
        } else {
            if (!this._loading_div) {
                this._loading_div = document.createElement('div');
                this._loading_div.className = 'loading';
                this.append(this._loading_div);
            }
            if (soon) {
                this._loading_div.classList.add('soon');
            } else {
                this._loading_div.classList.remove('soon');
            }
        }
    }

    mark_pages_dirty() {
        for (const [_, page] of this._pages)
            page.rendered = false;
    }

    /**
     * @param pdf_document {PDFDocumentProxy}
     */
    init_document(pdf_document) {
        this.pdf_doc = pdf_document;

        for (let i = 0; i < this.pdf_doc.numPages; ++i) {
            const page = document.createElement('div');
            page.classList.add('page');

            const text_layer = document.createElement("div");
            text_layer.classList.add('text-layer');

            const canvas = document.createElement('canvas');
            page.append(canvas)
            page.append(text_layer)
            this._elements.body.append(page);
            this._pages.set(i, {canvas: canvas, page: page, text_layer: text_layer, rendered: false});
        }
        this.set_zoom(1.0);
        this._set_loading(false, false);
    }

    set_zoom(percent) {
        this._zoom = percent;

        const height = this._elements.container.getBoundingClientRect().height * percent;
        for (const [_, page] of this._pages) {
            page.canvas.style.height = `${height}px`;
            page.canvas.style.width = `0`;
        }

        this.generate_pages_in_view();
    }

    get_pages_in_view() {
        const scroll_px = this._elements.container.scrollTop;
        const page_height = this._elements.container.getBoundingClientRect().height * this._zoom + 15 * 2;
        let page_in_view = Math.round(scroll_px / page_height);
        let pages = [];
        for (let i = Math.max(0, page_in_view - this.preload_range); i <= Math.min(page_in_view + this.preload_range, this.pdf_doc.numPages - 1); ++i) {
            pages.push(i);
        }
        return pages;
    }

    generate_pages_in_view() {
        for (const page of this.get_pages_in_view()) {
            let page_data = this._pages.get(page);
            if (!page_data.rendered) {
                page_data.rendered = true;
                this.render_page(page)
            }
        }
    }

    render_page(page_number) {
        this._page_render_pool.push(page_number);

        if (!this._is_rendering) {

            this._is_rendering = true;
            const render_page = () => {
                const page = this._page_render_pool.pop();

                const page_content = this._pages.get(page);
                page_content.canvas.style.width = `100%`;

                this.pdf_doc.getPage(page + 1).then(async (pdf_page) => {
                    const page_height = this._elements.container.getBoundingClientRect().height * this._zoom;
                    const viewport_scale = page_height / pdf_page.view[3];
                    const viewport = pdf_page.getViewport({scale: viewport_scale});

                    page_content.canvas.width = viewport.width;
                    page_content.canvas.height = viewport.height;
                    page_content.page.style.width = viewport.width + 'px';
                    page_content.page.style.height = viewport.height + 'px';

                    if (page_content.canvas.getContext) {
                        await pdf_page.render({
                            canvasContext: page_content.canvas.getContext("2d"),
                            viewport,
                        });
                    }

                    const text_content = await pdf_page.getTextContent();
                    page_content.text_layer.innerText = '';
                    text_content.items.forEach(textItem => {
                        if (!textItem.str || textItem.str.trim() === '')
                            return;
                        const div = document.createElement('div');
                        div.className = 'text-item';
                        div.textContent = textItem.str;

                        const transform = textItem.transform;
                        const fontSize = Math.hypot(transform[2] * viewport_scale, transform[3] * viewport_scale);
                        const x = transform[4] * viewport_scale;
                        const y = transform[5] * viewport_scale - fontSize * 0.25;

                        div.style.left = `${x}px`;
                        div.style.bottom = `${y}px`;
                        div.style.fontSize = `${fontSize}px`;

                        page_content.text_layer.appendChild(div);
                    });

                    if (this._page_render_pool.length !== 0) {
                        render_page();
                    } else {
                        this._is_rendering = false;
                        if (this._page_render_pool.length !== 0) {
                            this._is_rendering = true;
                            render_page();
                        }
                    }
                });
            }
            render_page()
        }
    }
}

customElements.define("pdf-embed", PdfViewer);