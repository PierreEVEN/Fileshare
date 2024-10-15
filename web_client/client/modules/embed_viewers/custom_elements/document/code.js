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

                    import('./prism_loader.js').then(prism_loader => {
                        prism_loader.build(this);
                    })
                });
    }
}

customElements.define("document-code", DocumentCode);