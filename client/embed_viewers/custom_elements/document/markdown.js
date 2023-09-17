import {convert_text} from "./showdown_loader";

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
                .then(text => this.innerHTML = convert_text(text));
    }
}

customElements.define("document-markdown", DocumentMarkdown);