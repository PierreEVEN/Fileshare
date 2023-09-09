const document_hbs = require('./document-embed.hbs')

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