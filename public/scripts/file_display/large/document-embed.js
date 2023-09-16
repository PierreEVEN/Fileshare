const document_hbs = require('./document-embed.hbs')
const showdown = require("showdown");

import Prism from 'prismjs';
Prism.manual = true;

import "prismjs/components/prism-json";
import "prismjs/components/prism-sass";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-css";
import "prismjs/components/prism-log";

import "prismjs/plugins/toolbar/prism-toolbar.css";
import "prismjs/plugins/toolbar/prism-toolbar";
import "prismjs/plugins/inline-color/prism-inline-color";
import "prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard";
import "prismjs/plugins/show-language/prism-show-language";
import "prismjs/plugins/previewers/prism-previewers";
import "prismjs/plugins/autolinker/prism-autolinker";

import "prismjs/themes/prism-okaidia.css";

class DocumentCode extends HTMLElement {
    constructor() {
        super();
        this.style.width = '100%';
        this.style.height = '100%';
        this.style.maxHeight = '100%';
        this.style.overflow = 'auto';
        this['white-space'] = 'pre-wrap'

        if (this.hasAttribute('src') && this.hasAttribute('class'))
            fetch(this.getAttribute('src'))
                .then(data => data.text())
                .then(text => {

                    const code = document.createElement('code');
                    code.classList.add(this.getAttribute('class'));
                    code['data-prismjs-copy'] = "Copy code";
                    code.innerHTML = text.substring(0, Math.min(text.length, 200000));

                    const pre = document.createElement('pre');
                    pre.classList.add('line-numbers')
                    pre.append(code);

                    this.append(pre);

                    Prism.highlightAllUnder(this);
                });
    }
}

customElements.define("document-code", DocumentCode);

class DocumentMarkdown extends HTMLElement {
    constructor() {
        super();
        this.style.backgroundColor = '#f5f5f5';
        this.style.color = '#262626';
        this.style.width = '100%';
        this.style.height = '100%';
        this.style.maxHeight = '100%';
        this.style.overflow = 'auto';

        if (this.hasAttribute('src'))
            fetch(this.getAttribute('src'))
                .then(data => data.text())
                .then(text => {
                    const converter = new showdown.Converter();
                    this.innerHTML = converter.makeHtml(text);
                });
    }
}

customElements.define("document-markdown", DocumentMarkdown);

class Document extends HTMLElement {
    constructor() {
        super();
        this.style.backgroundColor = '#f5f5f5';
        this.style.color = '#262626';
        this.style.width = '100%';
        this.style.height = '100%';
        this.style.maxHeight = '100%';

        if (this.hasAttribute('src'))
            fetch(this.getAttribute('src'))
                .then(data => {
                    const header = data.headers.get('Content-Disposition');
                    this.filename = header.split(';')[1].split('=')[1];
                    return data.text()
                })
                .then(text => {
                    const shadowRoot = this.attachShadow({mode: 'open'});

                    const lines = [];
                    let line_index = 0;
                    for (const item of text.split('\n')) {
                        const indent = item.search(/\S|$/)
                        lines.push({line: ++line_index, text: item, empty: item.length !== indent, indent: indent})
                    }

                    let line = 0;
                    shadowRoot.append(document_hbs({
                        title: decodeURIComponent(this.filename),
                        lines: lines,
                    }));
                });
    }
}

customElements.define("document-embed", Document);